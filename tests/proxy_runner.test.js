const assert = require('assert');
const { execSync } = require('child_process');
const path = require('path');

function runCheck() {
    execSync('node --check ../proxy_runner.js', { cwd: __dirname, stdio: 'pipe' });
    execSync('node --check ../action_renew.js', { cwd: __dirname, stdio: 'pipe' });
}

function safeRequire() {
    const proxyPath = path.join(__dirname, '..', 'proxy_runner.js');
    delete require.cache[require.resolve(proxyPath)];
    return require(proxyPath);
}

function tests() {
    const mod = safeRequire();
    assert.strictEqual(typeof mod.parseProxyLine, 'function');
    assert.strictEqual(typeof mod.buildHttpProxy, 'function');
    assert.strictEqual(typeof mod.maskProxyUrl, 'function');
    assert.strictEqual(typeof mod.loadProxies, 'function');
    assert.strictEqual(typeof mod.selectRandomProxy, 'function');
    assert.strictEqual(typeof mod.proxyKey, 'function');
    assert.strictEqual(typeof mod.safeProxyId, 'function');

    const samples = [
        {
            line: '1.2.3.4:8080:user:password',
            expect: { raw: '1.2.3.4:8080:user:password', ip: '1.2.3.4', port: '8080', username: 'user', password: 'password', valid: true }
        },
        {
            line: 'user:pass@1.2.3.4:8080',
            expect: { raw: 'user:pass@1.2.3.4:8080', ip: '1.2.3.4', port: '8080', username: 'user', password: 'pass', valid: true }
        },
        {
            line: '1.2.3.4:8080',
            expect: { raw: '1.2.3.4:8080', ip: '1.2.3.4', port: '8080', username: '', password: '', valid: true }
        },
        {
            line: '1.2.3.4:0',
            expect: { raw: '1.2.3.4:0', valid: false, reason: 'invalid_port:0' }
        },
        {
            line: '1.2.3.4:65536',
            expect: { raw: '1.2.3.4:65536', valid: false, reason: 'invalid_port:65536' }
        },
        {
            line: 'abc:def',
            expect: { raw: 'abc:def', valid: false, reason: 'invalid_port:def' }
        }
    ];

    for (const sample of samples) {
        const parsed = mod.parseProxyLine(sample.line);
        assert.deepStrictEqual(parsed, sample.expect, `parse failed: ${sample.line}`);
        if (parsed.valid) {
            const built = mod.buildHttpProxy(parsed);
            assert.strictEqual(built, `http://${parsed.username ? `${encodeURIComponent(parsed.username)}:${encodeURIComponent(parsed.password)}@` : ''}${parsed.ip}:${parsed.port}`);
            assert.strictEqual(mod.proxyKey(parsed), `${parsed.ip}:${parsed.port}`);
            assert.strictEqual(mod.safeProxyId(parsed), `${parsed.ip}:${parsed.port}`);
        }
    }

    const masked = mod.maskProxyUrl('http://myuser:mypass@1.2.3.4:8080');
    assert.ok(!masked.includes('myuser'), 'masked url must not include username');
    assert.ok(!masked.includes('mypass'), 'masked url must not include password');

    const selected = mod.selectRandomProxy([mod.parseProxyLine('1.2.3.4:8080:user:pass')], {});
    assert.ok(selected, 'selectRandomProxy should return parsed object');
    assert.ok(selected.parsed && selected.parsed.username === 'user', 'selected parsed should preserve username');

    console.log('[proxy-runner tests] all tests passed');
}

try {
    runCheck();
    tests();
} catch (e) {
    console.error('[proxy-runner tests] failed:', e.message);
    process.exit(1);
}
