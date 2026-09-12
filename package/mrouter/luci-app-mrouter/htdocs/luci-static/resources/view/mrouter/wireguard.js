'use strict';
'require view';
'require fs';
'require ui';

const HELPER = '/usr/libexec/mrouter-wireguard';


function mrouterBounded(promise, fallback, timeoutMs) {
    return Promise.race([
        Promise.resolve(promise).catch(function() { return fallback; }),
        new Promise(function(resolve) {
            window.setTimeout(function() { resolve(fallback); }, timeoutMs || 4500);
        })
    ]);
}

function mrouterExec(path, args, fallback, timeoutMs) {
    return mrouterBounded(
        fs.exec(path, args || []),
        fallback || { code: 124, stdout: '', stderr: 'Timed out' },
        timeoutMs || 4500
    );
}

function tx(v) {
    return [ String(v == null || v === '' ? '—' : v) ];
}

function parseStatus(r) {
    let out = {
        configured: false,
        running: false,
        publicKey: '',
        port: '51820',
        address: '10.14.0.1/24',
        publicIP: '',
        count: 0,
        clients: []
    };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'STATUS') {
            out.configured = p[1] === '1';
            out.running = p[2] === '1';
            out.publicKey = p[3] || '';
            out.port = p[4] || '51820';
            out.address = p[5] || '10.14.0.1/24';
            out.publicIP = p[6] || '';
            out.count = Number(p[7]) || 0;
        }

        if (p[0] === 'CLIENT' && p.length >= 3) {
            out.clients.push({
                id: p[1],
                name: p.slice(2).join('|')
            });
        }
    });

    return out;
}

function extractConfig(r) {
    let s = String((r && r.stdout) || '');
    let a = s.indexOf('CONFIG_BEGIN\n');
    let b = s.indexOf('\nCONFIG_END');

    if (a < 0 || b < 0)
        return '';

    return s.substring(a + 'CONFIG_BEGIN\n'.length, b);
}

function makeToggle(on) {
    return E('button', {
        'class': 'm-toggle m-toggle-small' + (on ? ' on' : ''),
        'type': 'button'
    }, [ E('span', {}) ]);
}

function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText)
        return navigator.clipboard.writeText(value);

    return new Promise(function(resolve, reject) {
        let t = document.createElement('textarea');
        t.value = value;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();

        try {
            document.execCommand('copy') ? resolve() : reject(new Error('Copy failed'));
        }
        catch (e) {
            reject(e);
        }
        finally {
            document.body.removeChild(t);
        }
    });
}

function downloadConfig(name, value) {
    let blob = new Blob([ value ], { type: 'text/plain' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');

    a.href = url;
    a.download = (name || 'mrouter-wireguard') + '.conf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: function() {
        return mrouterExec('/usr/libexec/mrouter-status-wireguard', [], { stdout: '' }, 4500).then(parseStatus);
    },

    render: function(st) {
        let endpoint = E('input', {
            'type': 'text',
            'class': 'm-ios-input',
            'value': st.publicIP || '',
            'placeholder': 'public IP or hostname'
        });

        let clientName = E('input', {
            'type': 'text',
            'class': 'm-ios-input',
            'placeholder': 'e.g. iPhone'
        });

        let fullTunnel = makeToggle(true);
        fullTunnel.addEventListener('click', function() {
            fullTunnel.classList.toggle('on');
        });

        let output = E('textarea', {
            'class': 'm-wg-config',
            'readonly': 'readonly',
            'placeholder': 'Generate or select a saved client to view its configuration here. Saved clients remain on Mrouter until you revoke them.'
        });

        let copy = E('button', {
            'class': 'm-secondary-button',
            'disabled': ''
        }, tx('Copy Config'));

        let download = E('button', {
            'class': 'm-secondary-button',
            'disabled': ''
        }, tx('Download .conf'));

        let currentName = 'mrouter-wireguard';

        copy.addEventListener('click', function() {
            if (!output.value)
                return;

            copyText(output.value).then(function() {
                ui.addNotification(null, E('p', {}, tx('WireGuard configuration copied.')), 'info');
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, tx(err.message)));
            });
        });

        download.addEventListener('click', function() {
            if (output.value)
                downloadConfig(currentName, output.value);
        });

        let generate = E('button', { 'class': 'm-primary-button' },
            tx(st.configured ? 'Generate Another Client' : 'Create Server + Client'));

        generate.addEventListener('click', function() {
            let host = endpoint.value.trim();
            let name = clientName.value.trim() || 'Mrouter Client';

            if (!host) {
                ui.addNotification(null, E('p', {},
                    tx('Enter the public IP address or DNS hostname used to reach Mrouter-OS.')));
                return;
            }

            generate.disabled = true;
            generate.textContent = 'Generating…';

            fs.exec(HELPER, [
                'generate',
                host,
                fullTunnel.classList.contains('on') ? '1' : '0',
                name
            ]).then(function(r) {
                if (!r || r.code !== 0)
                    throw new Error((r && (r.stderr || r.stdout)) || 'Generation failed');

                let cfg = extractConfig(r);
                if (!cfg)
                    throw new Error('The generated configuration could not be read.');

                output.value = cfg;
                currentName = name.replace(/[^A-Za-z0-9._-]+/g, '-') || 'mrouter-wireguard';
                copy.disabled = false;
                download.disabled = false;

                ui.addNotification(null, E('p', {},
                    tx('Client generated and saved on Mrouter-OS. You can copy or download it now.')), 'info');
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, tx(err.message)));
            }).finally(function() {
                generate.disabled = false;
                generate.textContent = st.configured ? 'Generate Another Client' : 'Create Server + Client';
            });
        });

        let clientList = E('div', { 'class': 'm-wg-client-list' });

        if (!st.clients.length) {
            clientList.appendChild(E('div', { 'class': 'm-empty' },
                tx('No generated WireGuard clients yet.')));
        }

        st.clients.forEach(function(client) {
            let viewBtn = E('button', { 'class': 'm-secondary-button' }, tx('View / Copy'));
            let revokeBtn = E('button', { 'class': 'm-danger-outline-button' }, tx('Revoke'));

            viewBtn.addEventListener('click', function() {
                viewBtn.disabled = true;

                fs.exec(HELPER, [ 'view', client.id ]).then(function(r) {
                    if (!r || r.code !== 0)
                        throw new Error((r && (r.stderr || r.stdout)) || 'Unable to read client');

                    let cfg = extractConfig(r);
                    if (!cfg)
                        throw new Error('Client configuration is empty.');

                    output.value = cfg;
                    currentName = client.name.replace(/[^A-Za-z0-9._-]+/g, '-') || ('client-' + client.id);
                    copy.disabled = false;
                    download.disabled = false;
                    output.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }).catch(function(err) {
                    ui.addNotification(null, E('p', {}, tx(err.message)));
                }).finally(function() {
                    viewBtn.disabled = false;
                });
            });

            revokeBtn.addEventListener('click', function() {
                if (!confirm('Revoke ' + client.name + '?'))
                    return;

                revokeBtn.disabled = true;

                fs.exec(HELPER, [ 'revoke', client.id ]).then(function(r) {
                    if (!r || r.code !== 0)
                        throw new Error((r && (r.stderr || r.stdout)) || 'Unable to revoke client');

                    window.location.reload();
                }).catch(function(err) {
                    ui.addNotification(null, E('p', {}, tx(err.message)));
                    revokeBtn.disabled = false;
                });
            });

            clientList.appendChild(E('div', { 'class': 'm-wg-client-row' }, [
                E('div', {}, [
                    E('strong', {}, tx(client.name)),
                    E('span', {}, tx('10.14.0.' + client.id))
                ]),
                E('div', { 'class': 'm-inline-actions' }, [ viewBtn, revokeBtn ])
            ]));
        });

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, tx('WireGuard')),
                    E('div', { 'class': 'm-subtitle' },
                        tx('Fast remote-access VPN for Mrouter-OS'))
                ]),
                E('strong', {
                    'class': st.running ? 'm-app-running' : 'm-app-stopped'
                }, tx(st.running ? 'Running' : (st.configured ? 'Configured' : 'Not configured')))
            ]),

            E('div', { 'class': 'm-wg-summary' }, [
                E('div', {}, [
                    E('span', {}, tx('VPN Address')),
                    E('strong', {}, tx(st.address))
                ]),
                E('div', {}, [
                    E('span', {}, tx('Listen Port')),
                    E('strong', {}, tx(st.port))
                ]),
                E('div', {}, [
                    E('span', {}, tx('Generated Clients')),
                    E('strong', {}, tx(st.count))
                ])
            ]),

            E('div', { 'class': 'm-app-card m-wg-card' }, [
                E('h3', {}, tx(st.configured ? 'Generate Client Configuration' : 'Quick Setup')),
                E('p', { 'class': 'm-wg-description' }, tx(
                    'Generated profiles are stored on Mrouter-OS until you revoke them. They no longer disappear after generation.'
                )),
                E('div', { 'class': 'm-wg-warning' }, tx(
                    'If Mrouter-OS is behind another router, forward UDP 51820 from the upstream router to the Mrouter WAN address before testing remote access.'
                )),

                E('div', { 'class': 'm-policy-form-grid' }, [
                    E('label', {}, [
                        E('span', {}, tx('Client name')),
                        clientName
                    ]),
                    E('label', {}, [
                        E('span', {}, tx('Public endpoint')),
                        endpoint
                    ]),
                    E('label', { 'class': 'm-inline-toggle-label' }, [
                        E('span', {}, tx('Full tunnel')),
                        fullTunnel
                    ])
                ]),

                E('div', { 'class': 'm-app-actions' }, [ generate ]),

                output,

                E('div', { 'class': 'm-app-actions m-inline-actions' }, [
                    copy,
                    download,
                    E('a', {
                        'class': 'm-secondary-link-button',
                        'href': L.url('admin/advanced/network-settings/interfaces')
                    }, tx('Advanced Interface Settings'))
                ])
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Generated Clients')),
                clientList
            ])
        ]);
    }
});
