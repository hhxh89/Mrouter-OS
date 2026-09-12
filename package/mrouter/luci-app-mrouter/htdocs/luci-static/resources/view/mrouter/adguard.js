'use strict';
'require view';
'require fs';


const HELPER =
    '/usr/libexec/mrouter-adguard';



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

function t(v) {
    return [
        String(
            v == null || v === ''
                ? '—'
                : v
        )
    ];
}


/*
 * The helper reports the configured LAN address, but an existing OpenWrt
 * installation may be managed through another address or hostname. Always
 * open AdGuard on the same host the user used to reach Mrouter, while
 * preserving AdGuard's configured scheme, port and path.
 */
function managementUrl(raw) {
    try {
        let u = new URL(raw || 'http://127.0.0.1:3000/', window.location.href);
        u.hostname = window.location.hostname;
        return u.toString();
    }
    catch (e) {
        let h = window.location.hostname || '127.0.0.1';
        if (h.indexOf(':') >= 0 && h.charAt(0) !== '[')
            h = '[' + h + ']';
        return 'http://' + h + ':3000/';
    }
}


function status() {

    return mrouterExec('/usr/libexec/mrouter-status-adguard', [], { stdout: '' }, 4500).then(function(r) {

        let line =
            String(r.stdout || '')
            .trim();

        let p =
            line.split('|');


        return {
            enabled:
                p[1] === '1',

            running:
                p[2] === '1',

            setup:
                p[3] === '1',

            dnsPort:
                p[4] || '0',

            url:
                p[5] || '#',

            routing:
                p[6] === '1'
        };
    });
}


return view.extend({

    handleSaveApply: null,
    handleSave: null,
    handleReset: null,


    load: status,


    render: function(st) {

        let toggle =
            E('button', {
                'class':
                    'm-toggle m-toggle-large ' +
                    (
                        st.enabled
                            ? 'on'
                            : ''
                    )
            }, [
                E('span', {})
            ]);


        let state =
            E('strong', {
                'class':
                    st.running
                        ? 'm-app-running'
                        : 'm-app-stopped'
            }, t(
                st.running
                    ? 'Running'
                    : 'Stopped'
            ));


        let dns =
            E('span', {}, t(
                st.routing
                    ? 'DNS traffic is using AdGuard Home'
                    : (
                        st.setup
                            ? 'AdGuard is configured; enable it to route DNS through it'
                            : 'First-time AdGuard Home setup is required'
                    )
            ));


        toggle.addEventListener(
            'click',
            function() {

                let enable =
                    !toggle.classList
                        .contains('on');


                toggle.disabled = true;


                fs.exec(
                    HELPER,
                    [
                        enable
                            ? 'enable'
                            : 'disable'
                    ]
                )
                .then(function() {

                    window.location.reload();

                });
            }
        );


        return E('div', {
            'class': 'mrouter-page'
        }, [

            E('div', {
                'class': 'm-page-title'
            }, [

                E('div', {}, [

                    E('h2', {},
                        t('AdGuard Home')
                    ),

                    E('div', {
                        'class':
                            'm-subtitle'
                    }, t(
                        'Network-wide DNS filtering and privacy protection'
                    ))
                ]),

                state
            ]),


            E('div', {
                'class':
                    'm-app-card'
            }, [

                E('div', {
                    'class':
                        'm-app-description'
                }, [

                    E('div', {
                        'class':
                            'm-adguard-icon'
                    }, t('A')),


                    E('div', {}, [

                        E('h3', {},
                            t('AdGuard Home')
                        ),

                        E('p', {},
                            t(
                                'Blocks advertising, trackers and unwanted DNS requests for devices using Mrouter-OS.'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-app-dns-state'
                        }, [
                            dns
                        ])
                    ])
                ]),


                E('div', {
                    'class':
                        'm-app-control-row'
                }, [

                    E('span', {},
                        t(
                            'Enable AdGuard Home'
                        )
                    ),

                    toggle
                ]),


                E('div', {
                    'class':
                        'm-app-actions'
                }, [

                    E('a', {
                        'class':
                            'm-blue-link-button',

                        'href':
                            managementUrl(st.url),

                        'target':
                            '_blank',

                        'rel':
                            'noopener'
                    }, t(
                        st.setup
                            ? 'Open AdGuard Home'
                            : 'Set up AdGuard Home'
                    ))
                ])
            ])
        ]);
    }
});
