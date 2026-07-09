const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const accountController = require('../controllers/accountController');

const parseCookies = (request) => {
    const list = {};
    const rc = request.headers.cookie;
    rc && rc.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
};

const handleRequest = (req, res) => {
    try {
        if (req.query.page) {
            return accountController.render_page(req, res);
        }

        if (req.query.account) {
            const action = req.query.account;
            
            // Authentication check for admin routes
            const publicAccountActions = ['login', 'admin_login', 'logout', 'distributor_portal'];
            if (!publicAccountActions.includes(action)) {
                const cookies = parseCookies(req);
                if (cookies.admin_auth !== 'logged_in') {
                    return res.redirect('/?account=login');
                }
            }

            if(accountController[action]) {
                return accountController[action](req, res);
            }
            return res.status(404).send('الصفحة غير موجودة');
        }

        if (req.query.app) {
            const parts = req.query.app.split('.');
            const moduleName = parts[0];
            const action = parts[1];
            const id = parts[2];

            // Mapping module actions to controller functions
            const routes = {
                'product': productController[action],
                'reels': productController['view_reels'],
                'cart': productController['view_cart'],
                'wishlist': productController['view_wishlist'],
                'orders': productController['view_orders'],
                'order': productController[action] || productController['submit_order']
            };

            if (routes[moduleName]) {
                return routes[moduleName](req, res, id);
            }
            
            return res.status(404).send('القسم غير موجود');
        }

        return productController.home(req, res);

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ داخلي في النظام');
    }
};

router.get('/', handleRequest);
router.post('/', handleRequest);

module.exports = router;
