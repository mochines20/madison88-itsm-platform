const app = require('./src/app');

function printRoutes(stack, prefix = '') {
    stack.forEach(layer => {
        if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
            console.log(`${methods} ${prefix}${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle.stack) {
            printRoutes(layer.handle.stack, prefix + (layer.regexp.source.replace('^\\', '').replace('\\/?(?=\\/|$)', '')).replace(/\\\//g, '/').replace(/\?$/, ''));
        }
    });
}

console.log('Registered Routes:');
printRoutes(app._router.stack);
process.exit();
