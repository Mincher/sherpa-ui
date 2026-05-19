const PERMISSIONS = [
  { value: 'read',         label: 'View projects',        selected: true  },
  { value: 'comment',      label: 'Comment on issues',    selected: true  },
  { value: 'create',       label: 'Create new projects',  selected: false },
  { value: 'edit',         label: 'Edit project settings',selected: false },
  { value: 'invite',       label: 'Invite collaborators', selected: false },
  { value: 'manage_keys',  label: 'Manage API keys',      selected: false },
  { value: 'manage_billing', label: 'Manage billing',     selected: false },
  { value: 'admin',        label: 'Workspace admin',      selected: false },
];

const REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)', selected: true  },
  { value: 'us-west-2', label: 'US West (Oregon)',      selected: true  },
  { value: 'eu-west-1', label: 'EU (Ireland)',          selected: false },
  { value: 'eu-central-1', label: 'EU (Frankfurt)',     selected: false },
  { value: 'ap-southeast-1', label: 'AP (Singapore)',   selected: false },
  { value: 'ap-northeast-1', label: 'AP (Tokyo)',       selected: false },
];

const MEMBERS = [
  { value: 'u1',  label: 'Alex Doe — alex@acme.io',       selected: true  },
  { value: 'u2',  label: 'Priya Singh — priya@acme.io',   selected: true  },
  { value: 'u3',  label: 'Sam Carter — sam@acme.io',      selected: false },
  { value: 'u4',  label: 'Jordan Lee — jordan@acme.io',   selected: false },
  { value: 'u5',  label: 'Robin Choi — robin@acme.io',    selected: false },
  { value: 'u6',  label: 'Casey Nguyen — casey@acme.io',  selected: false },
  { value: 'u7',  label: 'Morgan Patel — morgan@acme.io', selected: false },
];

function apply(list, opts) {
  if (!list) return;
  if (typeof list.setOptions === 'function') list.setOptions(opts);
}

export default {
  'transfer-permissions': (root) => apply(root.querySelector('sherpa-transfer-list'), PERMISSIONS),
  'transfer-regions':     (root) => apply(root.querySelector('sherpa-transfer-list'), REGIONS),
  'transfer-members':     (root) => apply(root.querySelector('sherpa-transfer-list'), MEMBERS),
};
