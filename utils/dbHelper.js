const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '../data/db.json');
const ordersPath = path.join(__dirname, '../data/orders.json');
const distributorsPath = path.join(__dirname, '../data/distributors.json');
const pagesPath = path.join(__dirname, '../data/pages.json');

module.exports = {
    readData: () => {
        if (!fs.existsSync(dbPath)) return { products: [], categories: [] };
        return JSON.parse(fs.readFileSync(dbPath));
    },
    writeData: (data) => {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    },
    readOrders: () => {
        if (!fs.existsSync(ordersPath)) return [];
        return JSON.parse(fs.readFileSync(ordersPath));
    },
    writeOrders: (data) => {
        fs.writeFileSync(ordersPath, JSON.stringify(data, null, 2));
    },
    readDistributors: () => {
        if (!fs.existsSync(distributorsPath)) return [];
        return JSON.parse(fs.readFileSync(distributorsPath));
    },
    writeDistributors: (data) => {
        fs.writeFileSync(distributorsPath, JSON.stringify(data, null, 2));
    },
    readPages: () => {
        if (!fs.existsSync(pagesPath)) return [];
        try {
            return JSON.parse(fs.readFileSync(pagesPath));
        } catch (e) {
            return [];
        }
    },
    writePages: (data) => {
        fs.writeFileSync(pagesPath, JSON.stringify(data, null, 2));
    },
    readAnalytics: () => {
        const analyticsPath = path.join(__dirname, '../data/analytics.json');
        if (!fs.existsSync(analyticsPath)) return { visits: 0, add_to_cart: 0, start_checkout: 0, history: [] };
        try {
            return JSON.parse(fs.readFileSync(analyticsPath));
        } catch (e) {
            return { visits: 0, add_to_cart: 0, start_checkout: 0, history: [] };
        }
    },
    writeAnalytics: (data) => {
        const analyticsPath = path.join(__dirname, '../data/analytics.json');
        fs.writeFileSync(analyticsPath, JSON.stringify(data, null, 2));
    }
};
