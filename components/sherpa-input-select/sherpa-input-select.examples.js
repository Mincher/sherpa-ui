const TIMEZONE_OPTIONS = [
  { value: 'America/Los_Angeles', label: 'Pacific Time \u2014 Los Angeles (UTC\u22128)' },
  { value: 'America/Denver',      label: 'Mountain Time \u2014 Denver (UTC\u22127)' },
  { value: 'America/Chicago',     label: 'Central Time \u2014 Chicago (UTC\u22126)' },
  { value: 'America/New_York',    label: 'Eastern Time \u2014 New York (UTC\u22125)' },
  { value: 'Europe/London',       label: 'London (UTC+0)' },
  { value: 'Europe/Paris',        label: 'Central European \u2014 Paris (UTC+1)' },
  { value: 'Europe/Athens',       label: 'Eastern European \u2014 Athens (UTC+2)' },
  { value: 'Asia/Dubai',          label: 'Gulf Standard \u2014 Dubai (UTC+4)' },
  { value: 'Asia/Kolkata',        label: 'India Standard \u2014 Mumbai (UTC+5:30)' },
  { value: 'Asia/Singapore',      label: 'Singapore (UTC+8)' },
  { value: 'Asia/Tokyo',          label: 'Japan Standard \u2014 Tokyo (UTC+9)' },
  { value: 'Australia/Sydney',    label: 'Australian Eastern \u2014 Sydney (UTC+10)' },
];

export default {
  'input-select-3': (root) => {
    root.querySelector('sherpa-input-select')?.setOptions?.(TIMEZONE_OPTIONS);
  },
};
