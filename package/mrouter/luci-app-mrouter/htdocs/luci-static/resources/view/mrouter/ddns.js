'use strict';
'require view';
'require fs';
'require ui';

const HELPER = '/usr/libexec/mrouter-ddns';


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

function makeToggle(on) {
    return E('button', {
        'class': 'm-toggle m-toggle-small' + (on ? ' on' : ''),
        'type': 'button'
    }, [ E('span', {}) ]);
}

function parseStatus(r) {
    let out = { publicIP: '', services: [] };

    String((r && r.stdout) || '').split(/\r?\n/).forEach(function(line) {
        let p = line.split('|');

        if (p[0] === 'PUBLIC')
            out.publicIP = p[1] || '';

        if (p[0] === 'SERVICE' && p.length >= 9) {
            out.services.push({
                id: p[1],
                enabled: p[2] === '1',
                provider: p[3],
                hostname: p[4],
                username: p[5],
                lastIP: p[6],
                lastTime: Number(p[7]) || 0,
                result: p.slice(8).join('|') || 'Never updated'
            });
        }
    });

    return out;
}

function providerName(v) {
    return ({
        cloudflare: 'Cloudflare',
        duckdns: 'DuckDNS',
        desec: 'deSEC / dedyn.io',
        dynu: 'Dynu'
    })[v] || v;
}

function timeText(epoch) {
    if (!epoch) return 'Never';
    try { return new Date(epoch * 1000).toLocaleString(); }
    catch (e) { return '—'; }
}

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: function() {
        return mrouterExec('/usr/libexec/mrouter-status-ddns', [], { stdout: '' }, 4500).then(parseStatus);
    },

    render: function(state) {
        let provider = E('select', { 'class': 'm-ios-input' }, [
            E('option', { 'value': 'cloudflare' }, tx('Cloudflare — own domain')),
            E('option', { 'value': 'duckdns' }, tx('DuckDNS — free hostname')),
            E('option', { 'value': 'desec' }, tx('deSEC — free DNS + DNSSEC')),
            E('option', { 'value': 'dynu' }, tx('Dynu — free hostname'))
        ]);

        let hostname = E('input', {
            'class': 'm-ios-input m-wide-input',
            'type': 'text',
            'placeholder': 'home.example.com'
        });

        let username = E('input', {
            'class': 'm-ios-input m-wide-input',
            'type': 'text',
            'placeholder': 'Only required for Dynu'
        });

        let secret = E('input', {
            'class': 'm-ios-input m-wide-input',
            'type': 'password',
            'autocomplete': 'new-password',
            'placeholder': 'API token / update token'
        });

        let providerHelp = E('div', { 'class': 'm-ddns-help' });

        function updateHelp() {
            let v = provider.value;
            let nodes = [];

            if (v === 'cloudflare') {
                nodes = [
                    E('strong', {}, tx('Cloudflare')),
                    E('span', {}, tx(
                        'Enter a full hostname such as home.example.com and a scoped API Token with Zone:Read + DNS:Edit for that zone. Mrouter discovers the zone and A record automatically.'
                    )),
                    E('a', {
                        'href': 'https://dash.cloudflare.com/profile/api-tokens',
                        'target': '_blank',
                        'rel': 'noopener'
                    }, tx('Create Cloudflare API Token'))
                ];
                username.disabled = true;
                username.value = '';
            }
            else if (v === 'duckdns') {
                nodes = [
                    E('strong', {}, tx('DuckDNS')),
                    E('span', {}, tx(
                        'Free hostname service. Enter yourname.duckdns.org and the DuckDNS token.'
                    )),
                    E('a', {
                        'href': 'https://www.duckdns.org/',
                        'target': '_blank',
                        'rel': 'noopener'
                    }, tx('Open DuckDNS'))
                ];
                username.disabled = true;
                username.value = '';
            }
            else if (v === 'desec') {
                nodes = [
                    E('strong', {}, tx('deSEC / dedyn.io')),
                    E('span', {}, tx(
                        'Free DNS hosting with DNSSEC. Enter the full hostname and a deSEC dynDNS token.'
                    )),
                    E('a', {
                        'href': 'https://desec.io/',
                        'target': '_blank',
                        'rel': 'noopener'
                    }, tx('Open deSEC'))
                ];
                username.disabled = true;
                username.value = '';
            }
            else {
                nodes = [
                    E('strong', {}, tx('Dynu')),
                    E('span', {}, tx(
                        'Free third-level hostname or your own domain. Enter your Dynu username and update password/token.'
                    )),
                    E('a', {
                        'href': 'https://www.dynu.com/',
                        'target': '_blank',
                        'rel': 'noopener'
                    }, tx('Open Dynu'))
                ];
                username.disabled = false;
            }

            L.dom.content(providerHelp, nodes);
        }

        provider.addEventListener('change', updateHelp);
        updateHelp();

        let add = E('button', { 'class': 'm-primary-button' }, tx('Add DDNS'));

        add.addEventListener('click', function() {
            add.disabled = true;

            fs.exec(HELPER, [
                'add',
                provider.value,
                hostname.value.trim(),
                username.value.trim(),
                secret.value
            ]).then(function(r) {
                if (!r || r.code !== 0)
                    throw new Error((r && (r.stderr || r.stdout)) || 'Unable to add DDNS service');

                window.location.reload();
            }).catch(function(err) {
                ui.addNotification(null, E('p', {}, tx(err.message)));
                add.disabled = false;
            });
        });

        let list = E('div', { 'class': 'm-ddns-list' });

        if (!state.services.length) {
            list.appendChild(E('div', { 'class': 'm-empty' },
                tx('No Dynamic DNS hostname has been configured yet.')));
        }

        state.services.forEach(function(svc) {
            let tog = makeToggle(svc.enabled);

            tog.addEventListener('click', function() {
                let wanted = !tog.classList.contains('on');
                tog.disabled = true;

                fs.exec(HELPER, [ 'toggle', svc.id, wanted ? '1' : '0' ])
                    .then(function() { window.location.reload(); });
            });

            let update = E('button', { 'class': 'm-secondary-button' }, tx('Update Now'));
            update.addEventListener('click', function() {
                update.disabled = true;
                fs.exec(HELPER, [ 'force', svc.id ]).then(function(r) {
                    if (!r || r.code !== 0)
                        throw new Error((r && (r.stderr || r.stdout)) || 'Update failed');
                    window.location.reload();
                }).catch(function(err) {
                    ui.addNotification(null, E('p', {}, tx(err.message)));
                    update.disabled = false;
                });
            });

            let remove = E('button', { 'class': 'm-danger-outline-button' }, tx('Remove'));
            remove.addEventListener('click', function() {
                if (!confirm('Remove DDNS hostname ' + svc.hostname + '?'))
                    return;

                remove.disabled = true;
                fs.exec(HELPER, [ 'delete', svc.id ])
                    .then(function() { window.location.reload(); });
            });

            list.appendChild(E('div', { 'class': 'm-ddns-card' }, [
                E('div', { 'class': 'm-ddns-card-head' }, [
                    E('div', {}, [
                        E('strong', {}, tx(svc.hostname)),
                        E('span', {}, tx(providerName(svc.provider)))
                    ]),
                    tog
                ]),
                E('div', { 'class': 'm-ddns-stats' }, [
                    E('div', {}, [
                        E('span', {}, tx('Public IPv4')),
                        E('strong', {}, tx(svc.lastIP || state.publicIP || '—'))
                    ]),
                    E('div', {}, [
                        E('span', {}, tx('Last update')),
                        E('strong', {}, tx(timeText(svc.lastTime)))
                    ]),
                    E('div', {}, [
                        E('span', {}, tx('Result')),
                        E('strong', {}, tx(svc.result))
                    ])
                ]),
                E('div', { 'class': 'm-app-actions m-two-actions' }, [
                    update,
                    remove
                ])
            ]));
        });

        return E('div', { 'class': 'mrouter-page' }, [
            E('div', { 'class': 'm-page-title' }, [
                E('div', {}, [
                    E('h2', {}, tx('Dynamic DNS')),
                    E('div', { 'class': 'm-subtitle' },
                        tx('Keep a hostname pointed at your current public IP'))
                ]),
                E('span', { 'class': 'm-status-pill m-status-online' },
                    tx(state.publicIP || 'Checking IP'))
            ]),

            E('div', { 'class': 'm-app-card m-ddns-setup' }, [
                E('div', { 'class': 'm-app-description' }, [
                    E('div', { 'class': 'm-ddns-icon' }, tx('D')),
                    E('div', {}, [
                        E('h3', {}, tx('Easy DDNS Setup')),
                        E('p', {}, tx(
                            'Cloudflare is the best choice if you already own a domain. DuckDNS, deSEC and Dynu provide free hostname options.'
                        ))
                    ])
                ]),

                E('div', { 'class': 'm-policy-form-grid' }, [
                    E('label', {}, [ E('span', {}, tx('Provider')), provider ]),
                    E('label', {}, [ E('span', {}, tx('Hostname')), hostname ]),
                    E('label', {}, [ E('span', {}, tx('Username')), username ])
                ]),

                E('label', { 'class': 'm-ddns-secret-row' }, [
                    E('span', {}, tx('API / update token')),
                    secret
                ]),

                providerHelp,

                E('div', { 'class': 'm-app-actions' }, [ add ])
            ]),

            E('div', { 'class': 'm-section' }, [
                E('h3', {}, tx('Configured Hostnames')),
                list
            ])
        ]);
    }
});
