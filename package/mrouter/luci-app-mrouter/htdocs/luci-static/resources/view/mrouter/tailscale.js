'use strict';
'require view';
'require fs';
'require poll';
'require ui';

const HELPER = '/usr/libexec/mrouter-tailscale';



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
    return [
        String(
            v == null || v === ''
                ? '—'
                : v
        )
    ];
}


function parse(r) {
    let s = {
        enabled: false,
        service: false,
        connected: false,
        backend: 'Unknown',
        ip: '',
        account: '',
        tailnet: '',
        hostname: '',
        lan: '',
        advLan: false,
        runExit: false,
        snat: true,
        acceptRoutes: false,
        acceptDns: false,
        exitNode: '',
        authUrl: ''
    };

    String((r && r.stdout) || '')
        .split(/\r?\n/)
        .forEach(function(line) {
            let p = line.split('|');

            if (p[0] === 'STATUS') {
                s.enabled = p[1] === '1';
                s.service = p[2] === '1';
                s.connected = p[3] === '1';
                s.backend = p[4] || 'Unknown';
                s.ip = p[5] || '';
                s.account = p[6] || '';
                s.tailnet = p[7] || '';
                s.hostname = p[8] || '';
                s.lan = p[9] || '';
                s.advLan = p[12] === '1';
                s.runExit = p[15] === '1';
                s.snat = p[16] === '1';
                s.acceptRoutes = p[17] === '1';
                s.acceptDns = p[18] === '1';
                s.exitNode = p[19] || '';
                s.authUrl = p[20] || '';
            }

            if (p[0] === 'BIND' && p[1])
                s.authUrl = p[1];
        });

    return s;
}


function loadStatus() {
    return mrouterExec('/usr/libexec/mrouter-status-tailscale', [], { stdout: '' }, 4500).then(parse);
}


function toggle(initial) {
    let el = E('button', {
        'class':
            'm-toggle m-toggle-small' +
            (initial ? ' on' : ''),
        'type': 'button'
    }, [
        E('span', {})
    ]);

    el.addEventListener(
        'click',
        function() {
            if (!el.disabled)
                el.classList.toggle('on');
        }
    );

    return el;
}


function isOn(el) {
    return el.classList.contains('on');
}


return view.extend({

    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    load: loadStatus,

    render: function(st) {

        let initialConnected =
            st.connected;

        let state =
            E('strong', {
                'class':
                    st.connected
                        ? 'm-app-running'
                        : 'm-app-stopped'
            }, tx(
                st.connected
                    ? 'Connected'
                    : (
                        st.backend === 'NeedsLogin'
                            ? 'Bind required'
                            : 'Disconnected'
                    )
            ));


        if (!st.connected) {

            let bindButton =
                E('button', {
                    'class':
                        'm-primary-button'
                }, tx(
                    st.authUrl
                        ? 'Refresh Bind Link'
                        : 'Enable & Get Bind Link'
                ));


            let bindLink =
                E('a', {
                    'class':
                        'm-blue-link-button m-ts-bind-link',
                    'href':
                        st.authUrl || '#',
                    'target':
                        '_blank',
                    'rel':
                        'noopener',
                    'style':
                        st.authUrl
                            ? ''
                            : 'display:none'
                }, tx(
                    'Bind Mrouter-OS to Tailscale'
                ));


            bindButton.addEventListener(
                'click',
                function() {

                    bindButton.disabled = true;
                    bindButton.textContent =
                        'Preparing…';


                    fs.exec(
                        HELPER,
                        [ 'bind' ]
                    )
                    .then(function(r) {

                        if (!r ||
                            r.code !== 0) {

                            throw new Error(
                                (r &&
                                    (r.stderr ||
                                     r.stdout)) ||
                                'Unable to start Tailscale'
                            );
                        }


                        let x = parse(r);


                        if (x.connected) {
                            window.location.reload();
                            return;
                        }


                        if (x.authUrl) {

                            bindLink.href =
                                x.authUrl;

                            bindLink.style.display =
                                '';

                            bindButton.textContent =
                                'Refresh Bind Link';

                        }
                        else {

                            bindButton.textContent =
                                'Try Again';

                            let info =
                                String(
                                    r.stdout || ''
                                )
                                .split(/\r?\n/)
                                .filter(function(line) {
                                    return line
                                        .indexOf('INFO|') === 0;
                                })
                                .map(function(line) {
                                    return line.substring(5);
                                })[0];


                            ui.addNotification(
                                null,
                                E('p', {}, tx(
                                    info ||
                                    'Tailscale has not returned a bind link yet. Press Try Again.'
                                ))
                            );
                        }

                    })
                    .catch(function(err) {

                        ui.addNotification(
                            null,
                            E('p', {},
                                tx(err.message)
                            )
                        );

                        bindButton.textContent =
                            'Try Again';

                    })
                    .finally(function() {

                        bindButton.disabled =
                            false;

                    });
                }
            );


            poll.add(
                function() {
                    return loadStatus()
                        .then(function(now) {

                            if (!initialConnected && now.connected) {
                                return fs.exec(HELPER, [ 'finalize' ])
                                    .catch(function() { return null; })
                                    .then(function() { window.location.reload(); });
                            }

                        });
                },
                3
            );


            return E('div', {
                'class':
                    'mrouter-page'
            }, [

                E('div', {
                    'class':
                        'm-page-title'
                }, [

                    E('div', {}, [

                        E('h2', {},
                            tx('Tailscale')
                        ),

                        E('div', {
                            'class':
                                'm-subtitle'
                        }, tx(
                            'Connect Mrouter-OS securely to your Tailnet'
                        ))
                    ]),

                    state
                ]),


                E('div', {
                    'class':
                        'm-app-card m-ts-card'
                }, [

                    E('div', {
                        'class':
                            'm-app-description'
                    }, [

                        E('div', {
                            'class':
                                'm-ts-icon'
                        }, tx('T')),

                        E('div', {}, [

                            E('h3', {},
                                tx(
                                    'Connect Mrouter-OS'
                                )
                            ),

                            E('p', {},
                                tx(
                                    'One-time setup: enable Tailscale, open the Device Bind Link and confirm Mrouter-OS in your Tailscale account.'
                                )
                            )
                        ])
                    ]),


                    E('div', {
                        'class':
                            'm-ts-easy-steps'
                    }, [

                        E('div', {}, [
                            E('b', {}, tx('1')),
                            E('span', {},
                                tx('Enable Tailscale')
                            )
                        ]),

                        E('div', {}, [
                            E('b', {}, tx('2')),
                            E('span', {},
                                tx('Open Device Bind Link')
                            )
                        ]),

                        E('div', {}, [
                            E('b', {}, tx('3')),
                            E('span', {},
                                tx('Confirm Mrouter-OS')
                            )
                        ])
                    ]),


                    E('div', {
                        'class':
                            'm-app-actions m-ts-bind-actions'
                    }, [
                        bindButton,
                        bindLink
                    ]),


                    E('div', {
                        'class':
                            'm-ts-default-note'
                    }, [

                        E('strong', {},
                            tx(
                                'LAN-only router access'
                            )
                        ),

                        E('span', {},
                            tx(
                                'After binding, Mrouter-OS advertises only the LAN subnet to Tailscale. The IoT network stays isolated and is never advertised to the Tailnet.'
                            )
                        )
                    ])
                ])
            ]);
        }


        let runExit =
            toggle(st.runExit);

        let snat =
            toggle(st.snat);

        let customExit =
            toggle(!!st.exitNode);


        let exitInput =
            E('input', {
                'class':
                    'm-ios-input',
                'type':
                    'text',
                'value':
                    st.exitNode || '',
                'placeholder':
                    '100.x.x.x or Tailnet device name'
            });


        let apply =
            E('button', {
                'class':
                    'm-primary-button'
            }, tx(
                'Apply Router Settings'
            ));


        apply.addEventListener(
            'click',
            function() {

                apply.disabled = true;
                apply.textContent =
                    'Applying…';


                fs.exec(
                    HELPER,
                    [
                        'apply',
                        isOn(runExit) ? '1' : '0',
                        isOn(snat) ? '1' : '0',
                        '0',
                        isOn(customExit) ? '1' : '0',
                        exitInput.value.trim()
                    ]
                )
                .then(function(r) {

                    if (!r ||
                        r.code !== 0) {

                        throw new Error(
                            (r &&
                                (r.stderr ||
                                 r.stdout)) ||
                            'Unable to apply Tailscale settings'
                        );
                    }

                    window.location.reload();

                })
                .catch(function(err) {

                    ui.addNotification(
                        null,
                        E('p', {},
                            tx(err.message)
                        )
                    );

                    apply.disabled = false;
                    apply.textContent =
                        'Apply Router Settings';

                });
            }
        );


        let disable =
            E('button', {
                'class':
                    'm-danger-outline-button'
            }, tx(
                'Disconnect Tailscale'
            ));


        disable.addEventListener(
            'click',
            function() {

                if (!confirm(
                    'Disconnect Mrouter-OS from Tailscale?'
                ))
                    return;

                disable.disabled = true;

                fs.exec(
                    HELPER,
                    [ 'disable' ]
                )
                .then(function() {
                    window.location.reload();
                });
            }
        );


        return E('div', {
            'class':
                'mrouter-page'
        }, [

            E('div', {
                'class':
                    'm-page-title'
            }, [

                E('div', {}, [

                    E('h2', {},
                        tx('Tailscale')
                    ),

                    E('div', {
                        'class':
                            'm-subtitle'
                    }, tx(
                        'Mrouter-OS LAN subnet router'
                    ))
                ]),

                state
            ]),


            E('div', {
                'class':
                    'm-ts-device-summary'
            }, [

                E('div', {}, [
                    E('span', {},
                        tx('DEVICE')
                    ),
                    E('strong', {},
                        tx(
                            st.hostname ||
                            'Mrouter-OS'
                        )
                    )
                ]),

                E('div', {}, [
                    E('span', {},
                        tx('TAILSCALE IP')
                    ),
                    E('strong', {},
                        tx(st.ip)
                    )
                ]),

                E('div', {}, [
                    E('span', {},
                        tx('TAILNET')
                    ),
                    E('strong', {},
                        tx(st.tailnet)
                    )
                ]),

                E('div', {}, [
                    E('span', {},
                        tx('ACCOUNT')
                    ),
                    E('strong', {},
                        tx(st.account)
                    )
                ])
            ]),


            E('div', {
                'class':
                    'm-app-card m-ts-card'
            }, [

                E('div', {
                    'class':
                        'm-app-description'
                }, [

                    E('div', {
                        'class':
                            'm-ts-icon'
                    }, tx('T')),

                    E('div', {}, [

                        E('h3', {},
                            tx('Router Access')
                        ),

                        E('p', {},
                            tx(
                                'Tailscale can reach the normal LAN only. IoT remains a separate private network.'
                            )
                        )
                    ])
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx(
                                'Advertised LAN Subnet'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            st.lan ||
                            'LAN subnet not detected'
                        ))
                    ]),

                    E('strong', {
                        'class':
                            st.advLan
                                ? 'm-app-running'
                                : 'm-app-stopped'
                    }, tx(
                        st.advLan
                            ? 'Advertised'
                            : 'Pending'
                    ))
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx(
                                'IoT Network'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            'Not advertised to Tailscale and isolated from LAN clients.'
                        ))
                    ]),

                    E('strong', {
                        'class':
                            'm-ts-isolated'
                    }, tx(
                        'Isolated'
                    ))
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx(
                                'Run as Exit Node'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            'Allow Tailnet devices to use this router\'s Internet connection.'
                        ))
                    ]),

                    runExit
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx(
                                'IP Masquerading'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            'Recommended for access from Tailscale to LAN devices.'
                        ))
                    ]),

                    snat
                ]),


                E('div', {
                    'class': 'm-setting-row'
                }, [
                    E('div', {}, [
                        E('span', {}, tx('Accept Tailnet Routes')),
                        E('div', { 'class': 'm-setting-note' }, tx('Disabled by Mrouter-OS to avoid importing overlapping subnet routes into the router.'))
                    ]),
                    E('strong', { 'class': 'm-app-stopped' }, tx('Off'))
                ]),


                E('div', {
                    'class':
                        'm-setting-group-title'
                }, tx(
                    'Use another Tailscale Exit Node'
                )),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx(
                                'Custom Exit Node'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            'Route Mrouter-OS Internet traffic through another Tailnet exit node.'
                        ))
                    ]),

                    customExit
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [
                    E('span', {},
                        tx('Exit Node')
                    ),
                    exitInput
                ]),


                E('div', {
                    'class':
                        'm-ts-approval-note'
                }, [

                    E('strong', {},
                        tx(
                            'Approve the LAN route in Tailscale'
                        )
                    ),

                    E('span', {},
                        tx(
                            'Tailscale normally requires the advertised LAN subnet to be approved in the Tailnet admin console unless autoApprovers are configured.'
                        )
                    ),

                    E('a', {
                        'href':
                            'https://console.tailscale.com/admin/machines',
                        'target':
                            '_blank',
                        'rel':
                            'noopener'
                    }, tx(
                        'Open Tailscale Admin Console'
                    ))
                ]),


                E('div', {
                    'class':
                        'm-app-actions m-two-actions'
                }, [
                    disable,
                    apply
                ])
            ])
        ]);
    }
});
