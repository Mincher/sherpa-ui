// Every refusal the page's CSP makes, before any module runs. TODO 215
window.__violations = [];
document.addEventListener('securitypolicyviolation', (e) => {
  window.__violations.push(`${e.violatedDirective}: ${e.blockedURI || e.sample || ''}`);
});
