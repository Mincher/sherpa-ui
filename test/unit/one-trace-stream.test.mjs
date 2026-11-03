/**
 * ONE TRACE STREAM — plan 695 S3. Each step of a host is a span; a request
 * carries its span as `traceparent`, and the host that answers joins that trace,
 * so a page's spans and its worker's are one. Spans are said to every context on
 * one channel; nobody listening, none is made.
 * TRAP T-one-trace-stream
 *
 *   node --test test/unit/one-trace-stream.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DataSource, HeldStore, TRACE_CHANNEL, createDataHandler, fakeRemote, onTrace, openRequestStore, tracing, defineStores,
} from '../../dist/data.js';
import { startSpan } from '../../dist/core/data/trace.js';

const tick = () => new Promise((done) => setTimeout(done, 20));
const ended = (spans, step) => spans.filter((s) => s.step === step && s.ms !== undefined);

/** A page's request store over a worker's handler, and every `traceparent` each way. */
async function pageOverWorker(store) {
  const handle = createDataHandler({ stores: defineStores(() => ({ people: store })), host: 'worker' });
  const sent = [];
  const echoed = [];
  const page = await openRequestStore({
    name: 'people',
    send: async (request) => {
      sent.push(request.headers.get('traceparent'));
      const response = await handle(request);
      echoed.push(response.headers.get('traceparent'));
      return response;
    },
  });
  return { handle, page, sent, echoed };
}

test('nobody listens: no span is made, and no request carries a traceparent', async () => {
  const { page, sent } = await pageOverWorker(new ArrayStore([{ id: 1 }], { key: 'id' }));
  await page.load();
  await page.update(1, { id: 1, owner: 'Cy' });
  assert.equal(tracing(), false);
  assert.equal(startSpan('anything'), null);
  assert.deepEqual(sent.filter(Boolean), []);
});

test('a page\'s request and its worker\'s answer are one trace: the answer runs under the request, the hold under the answer', async (t) => {
  const spans = [];
  t.after(onTrace((span) => spans.push(span)));
  const held = new HeldStore(fakeRemote(new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }), { delay: 0 }));
  const { page, sent, echoed } = await pageOverWorker(held);
  await page.load();
  const [request] = ended(spans, 'request');
  const answer = ended(spans, 'answer').find((s) => s.trace === request.trace);
  const [hold] = ended(spans, 'hold');
  assert.deepEqual([request.host, request.store, request.detail], ['page', 'people', { method: 'QUERY', status: 200 }]);
  assert.deepEqual([answer.host, answer.parent, answer.store], ['worker', request.id, 'people']);
  assert.deepEqual([hold.host, hold.trace, hold.parent, hold.store, hold.detail.rows], ['worker', request.trace, answer.id, 'people', 2]);
  assert.equal(sent.at(-1), `00-${request.trace}-${request.id}-01`, 'sent as W3C traceparent');
  assert.equal(echoed.at(-1), sent.at(-1), 'and echoed');
  assert.equal(spans.filter((s) => s.id === request.id).length, 2, 'said as it begins, and as it ends');
  assert.equal(spans.find((s) => s.id === request.id).ms, undefined);
  // A check behind is the worker's step too, under the request that asked it.
  await page.recheck();
  const asked = ended(spans, 'request').at(-1);
  const [recheck] = ended(spans, 'recheck');
  assert.deepEqual([recheck.host, recheck.trace, recheck.store], ['worker', asked.trace, 'people']);
});

test('many listen; one that throws breaks nothing; one stopped hears no more', () => {
  const a = [];
  const b = [];
  const stopA = onTrace((span) => a.push(span));
  const stopThrows = onTrace(() => { throw new Error('a listener\'s own fault'); });
  const stopB = onTrace((span) => b.push(span));
  startSpan('one').end();
  stopA();
  startSpan('two').end();
  stopThrows();
  stopB();
  assert.deepEqual([a.length, b.length], [2, 4]);
  assert.equal(tracing(), false, 'no one left listening');
});

test('a DataSource load says its start and its end', async (t) => {
  const spans = [];
  t.after(onTrace((span) => spans.push(span)));
  const source = new DataSource({ store: new ArrayStore([{ id: 1 }, { id: 2 }, { id: 3 }], { key: 'id' }) });
  await source.load();
  const loads = spans.filter((s) => s.step === 'load');
  assert.equal(loads.length, 2);
  assert.equal(loads[0].ms, undefined, 'its start');
  assert.deepEqual(loads[1].detail, { rows: 3, total: 3 }, 'its end');
});

test('another context listens on the channel: this one traces for it, and hears its spans', async (t) => {
  const other = new BroadcastChannel(TRACE_CHANNEL);
  other.unref?.();
  t.after(() => other.close());
  const got = [];
  other.onmessage = (e) => {
    if (e.data?.ask) other.postMessage({ listen: 'tab-two' });
    if (e.data?.span) got.push(e.data.span);
  };
  other.postMessage({ listen: 'tab-two' });
  await tick();
  assert.equal(tracing(), true, 'a listener in another context is enough');
  const { page } = await pageOverWorker(new ArrayStore([{ id: 1 }], { key: 'id' }));
  await page.load();
  await tick();
  assert.ok(got.some((s) => s.step === 'request' && s.ms !== undefined), 'its spans reach the other context');
  const heard = [];
  const stop = onTrace((span) => heard.push(span));
  other.postMessage({ span: { host: 'worker', step: 'send', trace: 'a'.repeat(32), id: 'b'.repeat(16), t: 0, ms: 1 } });
  await tick();
  stop();
  assert.deepEqual(heard.map((s) => s.step), ['send'], 'and the other context\'s are heard here');
  other.postMessage({ unlisten: 'tab-two' });
  await tick();
  assert.equal(tracing(), false);
});

test('a request that asks to be traced is, where no listener is known: its host says its spans', async (t) => {
  const other = new BroadcastChannel(TRACE_CHANNEL);
  other.unref?.();
  t.after(() => other.close());
  const got = [];
  other.onmessage = (e) => { if (e.data?.span) got.push(e.data.span); };
  assert.equal(tracing(), false);
  const handle = createDataHandler({ stores: defineStores(() => ({ people: new ArrayStore([{ id: 1 }], { key: 'id' }) })), host: 'worker' });
  const trace = 'c'.repeat(32);
  const response = await handle(new Request('http://test/sherpa/data/people', { headers: { traceparent: `00-${trace}-${'d'.repeat(16)}-01` } }));
  await tick();
  assert.equal(response.headers.get('traceparent'), `00-${trace}-${'d'.repeat(16)}-01`);
  assert.deepEqual(got.filter((s) => s.ms !== undefined).map((s) => [s.host, s.step, s.trace, s.parent]), [['worker', 'answer', trace, 'd'.repeat(16)]]);
  await handle(new Request('http://test/sherpa/data/people', { headers: { traceparent: `00-${trace}-${'d'.repeat(16)}-00` } }));
  await tick();
  assert.equal(got.length, 2, 'one not sampled is not');
});
