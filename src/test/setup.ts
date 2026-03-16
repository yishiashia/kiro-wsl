// Register vscode mock before any test imports
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
        return originalRequire.call(this, require.resolve('./__mocks__/vscode'));
    }
    return originalRequire.call(this, id);
};
