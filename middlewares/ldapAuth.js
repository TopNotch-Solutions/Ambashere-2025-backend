const ldap = require('ldapjs');
require('dotenv').config();

const ldapConfig = {
    url: process.env.LDAP_URL,
    baseDN: process.env.LDAP_BASE_DN,
    bindDN: process.env.LDAP_BIND_DN,
    bindPassword: process.env.LDAP_BIND_PASSWORD,
    searchBase: process.env.LDAP_SEARCH_BASE,
};

// Create a new LDAP client
const client = ldap.createClient({
    url: ldapConfig.url,
    reconnect: true,
    tlsOptions: {
        // If the server uses a self-signed certificate and you're on a secure internal network:
        rejectUnauthorized: false 
    },
    timeout: 5000, // Timeout for connection in milliseconds
    connectTimeout: 10000 // Timeout for connection setup
});

client.on('error', (err) => {
    console.error('LDAP client error:', err);
});

function authenticate(username, password, callback) {
    console.log(`Authenticating user: ${username}`);

    // Admin bind to perform the search
    client.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
        if (err) {
            console.error('Admin bind failed:', err);
            return callback(new Error('Failed to bind as admin'));
        }
        console.log('Admin bind successful');

        const opts = {
            filter: `(sAMAccountName=${username})`,
            scope: 'sub',
            attributes: ["*"] // Request specific attributes
        };
        console.log('Search options:', opts);

        client.search(ldapConfig.searchBase, opts, (err, res) => {
            if (err) {
                console.error('Search operation failed:', err);
                client.unbind();
                return callback(new Error('Search operation failed'));
            }

            let user = null;
            let userDN = null;

            // res.on('searchEntry', (entry) => {
            //     userDN = entry.dn.toString();
            //     console.log('DN found:', userDN);

            //     const sAMAccountName = entry.attributes.find(attr => attr.type === 'sAMAccountName')?.vals[0];

            //     if (sAMAccountName) {
            //         user = {
            //             username: sAMAccountName,
            //             displayName: entry.attributes.find(attr => attr.type === 'displayName')?.vals[0],
            //             email: entry.attributes.find(attr => attr.type === 'mail')?.vals[0],
            //         };
            //         console.log('User details extracted:', user, entry.attributes);
            //     }
            // });
            res.on('searchEntry', (entry) => {
    userDN = entry.dn.toString();
    console.log('DN found:', userDN);

    const allAttributes = {};

    entry.attributes.forEach(attr => {
        // If attribute has multiple values, return array
        // If single value, return the single value
        allAttributes[attr.type] = attr.vals.length > 1 
            ? attr.vals 
            : attr.vals[0];
    });

    user = allAttributes;

    console.log('User details extracted:', user);
});

            res.on('error', (err) => {
                console.error('LDAP search error:', err);
                client.unbind();
                return callback(new Error('LDAP search error'));
            });

            res.on('end', (result) => {
                console.log(`Search completed with status: ${result}`);

                if (!userDN) {
                    client.unbind();
                    console.warn(`No entry found for user: ${username}`);
                    return callback(new Error('User not found'));
                }
                
                client.bind(userDN, password, (err) => {
                    client.unbind();
                    if (err) {
                        console.error('User bind failed:', err);
                        return callback(new Error('Invalid credentials'));
                    }
                    console.log('User bind successful');
                    return callback(null, user);
                });
            });
        });
    });
}

module.exports = authenticate;
