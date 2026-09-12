'use strict';
'require view';
'require fs';
'require ui';


const HELPER =
    '/usr/libexec/mrouter-openvpn';




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



function bytes(v) {

    v = Number(v) || 0;


    if (v >= 1073741824)
        return (v / 1073741824)
            .toFixed(2) + ' GB';


    if (v >= 1048576)
        return (v / 1048576)
            .toFixed(2) + ' MB';


    if (v >= 1024)
        return (v / 1024)
            .toFixed(1) + ' KB';


    return v + ' B';
}



function parseStatus(r) {

    let out = {
        configured: false,
        connected: false,
        selected: '',
        remote: '',
        proto: '',
        device: '',
        tunnelIP: '',
        rx: 0,
        tx: 0,
        auth: false,
        profiles: []
    };


    String(
        (r && r.stdout) || ''
    )
    .split(/\r?\n/)
    .forEach(function(line) {

        let p =
            line.split('|');


        if (p[0] === 'STATUS') {

            out.configured =
                p[1] === '1';

            out.connected =
                p[2] === '1';

            out.selected =
                p[3] || '';

            out.remote =
                p[4] || '';

            out.proto =
                p[5] || '';

            out.device =
                p[6] || '';

            out.tunnelIP =
                p[7] || '';

            out.rx =
                Number(p[8]) || 0;

            out.tx =
                Number(p[9]) || 0;

            out.auth =
                p[10] === '1';
        }


        if (p[0] === 'PROFILE' &&
            p[1]) {

            out.profiles.push(
                p[1]
            );
        }

    });


    return out;
}



function loadStatus() {

    return mrouterExec('/usr/libexec/mrouter-status-openvpn', [], { stdout: '' }, 4500).then(parseStatus);
}



function makeToggle(state) {

    return E('button', {
        'class':
            'm-toggle m-toggle-small' +
            (state ? ' on' : '')
    }, [
        E('span', {})
    ]);
}



return view.extend({

    handleSaveApply: null,
    handleSave: null,
    handleReset: null,


    load: loadStatus,


    render: function(st) {

        let connectToggle =
            makeToggle(st.connected);

        connectToggle.disabled = !st.configured;
        if (!st.configured) connectToggle.title = 'Import and select an OpenVPN profile first';


        let connectionState =
            E('strong', {
                'class':
                    st.connected
                        ? 'm-app-running'
                        : 'm-app-stopped'
            }, tx(
                st.connected
                    ? 'Connected'
                    : (
                        st.configured
                            ? 'Disconnected'
                            : 'Not configured'
                    )
            ));


        let profileSelect =
            E('select', {
                'class':
                    'm-ios-input'
            });


        if (!st.profiles.length) {

            profileSelect.appendChild(
                E('option', {
                    'value': ''
                }, tx(
                    'No profiles imported'
                ))
            );

            profileSelect.disabled = true;

        }
        else {

            st.profiles.forEach(
                function(name) {

                    profileSelect.appendChild(
                        E('option', {
                            'value': name,
                            'selected':
                                name ===
                                st.selected
                                    ? ''
                                    : null
                        }, tx(name))
                    );
                }
            );

        }


        profileSelect.addEventListener(
            'change',
            function() {

                if (!profileSelect.value)
                    return;


                profileSelect.disabled = true;


                fs.exec(
                    HELPER,
                    [
                        'select',
                        profileSelect.value
                    ]
                )
                .then(function(r) {

                    if (!r ||
                        r.code !== 0) {

                        throw new Error(
                            r.stderr ||
                            r.stdout ||
                            'Unable to select profile'
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

                    profileSelect.disabled =
                        false;
                });
            }
        );


        connectToggle.addEventListener(
            'click',
            function() {

                if (!st.configured)
                    return;


                let wanted =
                    !connectToggle.classList
                        .contains('on');


                connectToggle.disabled = true;


                fs.exec(
                    HELPER,
                    [
                        'connect',
                        wanted ? '1' : '0'
                    ]
                )
                .then(function(r) {

                    if (!r ||
                        r.code !== 0) {

                        throw new Error(
                            r.stderr ||
                            r.stdout ||
                            'Unable to change OpenVPN state'
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

                    connectToggle.disabled =
                        false;
                });
            }
        );


        let uploadText =
            E('span', {},
                tx('Import VPN Configuration')
            );


        let upload =
            E('button', {
                'class':
                    'm-primary-button'
            }, [
                uploadText
            ]);


        upload.addEventListener(
            'click',
            function() {

                return ui.uploadFile(
                    '/tmp/mrouter-openvpn-upload',
                    uploadText.firstChild,
                    'Supported: .ovpn, .conf, .zip, .tar.gz and .tgz'
                )
                .then(function(reply) {

                    upload.disabled = true;


                    return fs.exec(
                        HELPER,
                        [
                            'import',
                            reply.name
                        ]
                    );
                })
                .then(function(r) {

                    if (!r ||
                        r.code !== 0) {

                        throw new Error(
                            r.stderr ||
                            r.stdout ||
                            'OpenVPN import failed'
                        );
                    }


                    window.location.reload();

                })
                .catch(function(err) {

                    if (err.message !==
                        'Upload has been cancelled') {

                        ui.addNotification(
                            null,
                            E('p', {},
                                tx(err.message)
                            )
                        );
                    }


                    upload.disabled = false;
                });
            }
        );


        let username =
            E('input', {
                'type':
                    'text',

                'class':
                    'm-ios-input',

                'autocomplete':
                    'username',

                'placeholder':
                    'VPN username'
            });


        let password =
            E('input', {
                'type':
                    'password',

                'class':
                    'm-ios-input',

                'autocomplete':
                    'current-password',

                'placeholder':
                    st.auth
                        ? 'Credentials saved'
                        : 'VPN password'
            });


        let saveCredentials =
            E('button', {
                'class':
                    'm-secondary-button'
            }, tx(
                'Save Credentials'
            ));


        saveCredentials.disabled = true;
        function updateCredentialButton() { saveCredentials.disabled = !(username.value.trim() && password.value); }
        username.addEventListener('input', updateCredentialButton);
        password.addEventListener('input', updateCredentialButton);

        saveCredentials.addEventListener(
            'click',
            function() {

                saveCredentials.disabled =
                    true;


                fs.exec(
                    HELPER,
                    [
                        'credentials',
                        username.value,
                        password.value
                    ]
                )
                .then(function(r) {

                    if (!r ||
                        r.code !== 0) {

                        throw new Error(
                            r.stderr ||
                            r.stdout ||
                            'Unable to save credentials'
                        );
                    }


                    password.value = '';

                    ui.addNotification(
                        null,
                        E('p', {},
                            tx(
                                'OpenVPN credentials updated.'
                            )
                        ),
                        'info'
                    );

                })
                .catch(function(err) {

                    ui.addNotification(
                        null,
                        E('p', {},
                            tx(err.message)
                        )
                    );

                })
                .finally(function() {

                    saveCredentials.disabled =
                        false;

                });
            }
        );


        let remove =
            E('button', {
                'class':
                    'm-danger-outline-button'
            }, tx(
                'Remove Imported Profiles'
            ));


        remove.disabled = !st.profiles.length;
        if (!st.profiles.length) remove.title = 'No imported profiles to remove';

        remove.addEventListener(
            'click',
            function() {

                if (!confirm(
                    'Remove all imported OpenVPN profiles?'
                ))
                    return;


                remove.disabled = true;


                fs.exec(
                    HELPER,
                    [ 'remove' ]
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
                        tx('OpenVPN')
                    ),

                    E('div', {
                        'class':
                            'm-subtitle'
                    }, tx(
                        'Simple VPN client configuration'
                    ))
                ]),

                connectionState
            ]),


            E('div', {
                'class':
                    'm-app-card m-vpn-card'
            }, [

                E('div', {
                    'class':
                        'm-app-description'
                }, [

                    E('div', {
                        'class':
                            'm-ovpn-icon'
                    }, tx('O')),

                    E('div', {}, [

                        E('h3', {},
                            tx(
                                'OpenVPN Client'
                            )
                        ),

                        E('p', {},
                            tx(
                                'Import the configuration supplied by your VPN provider, choose a server profile and connect.'
                            )
                        )
                    ])
                ]),


                E('div', {
                    'class':
                        'm-provider-row'
                }, [

                    E('span', {},
                        tx('Works with')
                    ),

                    E('div', {
                        'class':
                            'm-provider-badges'
                    }, [

                        E('i', {},
                            tx('NordVPN')
                        ),

                        E('i', {},
                            tx('Proton VPN')
                        ),

                        E('i', {},
                            tx('Surfshark')
                        ),

                        E('i', {},
                            tx('PIA')
                        ),

                        E('i', {},
                            tx('Mullvad')
                        ),

                        E('i', {},
                            tx('Custom OpenVPN')
                        )
                    ])
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx('Connection')
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            st.remote ||
                            'No OpenVPN server selected'
                        ))
                    ]),

                    connectToggle
                ]),


                E('div', {
                    'class':
                        'm-setting-row'
                }, [

                    E('div', {}, [

                        E('span', {},
                            tx(
                                'Configuration File'
                            )
                        ),

                        E('div', {
                            'class':
                                'm-setting-note'
                        }, tx(
                            'Select a server from an imported provider bundle.'
                        ))
                    ]),

                    profileSelect
                ]),


                E('div', {
                    'class':
                        'm-vpn-stat-grid'
                }, [

                    E('div', {}, [
                        E('span', {},
                            tx('Protocol')
                        ),
                        E('strong', {},
                            tx(
                                st.proto ||
                                '—'
                            )
                        )
                    ]),

                    E('div', {}, [
                        E('span', {},
                            tx('Tunnel')
                        ),
                        E('strong', {},
                            tx(
                                st.device ||
                                '—'
                            )
                        )
                    ]),

                    E('div', {}, [
                        E('span', {},
                            tx('VPN IP')
                        ),
                        E('strong', {},
                            tx(
                                st.tunnelIP ||
                                '—'
                            )
                        )
                    ]),

                    E('div', {}, [
                        E('span', {},
                            tx('Traffic')
                        ),
                        E('strong', {},
                            tx(
                                '↓ ' +
                                bytes(st.rx) +
                                '   ↑ ' +
                                bytes(st.tx)
                            )
                        )
                    ])
                ]),


                E('div', {
                    'class':
                        'm-setting-group-title'
                }, tx(
                    'Provider Login'
                )),


                E('div', {
                    'class':
                        'm-vpn-credentials'
                }, [

                    username,

                    password,

                    saveCredentials
                ]),


                E('div', {
                    'class':
                        'm-setting-group-title'
                }, tx(
                    'Import Configuration'
                )),


                E('div', {
                    'class':
                        'm-import-box'
                }, [

                    E('div', {}, [

                        E('strong', {},
                            tx(
                                'Upload .ovpn or provider bundle'
                            )
                        ),

                        E('p', {},
                            tx(
                                'Single .ovpn/.conf files and ZIP/TAR bundles containing multiple OpenVPN server profiles are supported.'
                            )
                        )
                    ]),

                    upload
                ]),


                E('div', {
                    'class':
                        'm-app-actions m-two-actions'
                }, [

                    E('a', {
                        'class':
                            'm-secondary-link-button',

                        'href':
                            L.url(
                                'admin/vpn/policy-routing'
                            )
                    }, tx(
                        'VPN Policy Routing'
                    )),

                    remove
                ])
            ])
        ]);
    }
});
