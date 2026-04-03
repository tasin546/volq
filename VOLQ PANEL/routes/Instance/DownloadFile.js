const express = require('express');
const router = express.Router();
const axios = require('axios');
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');

router.get("/instance/:id/files/download/:file", async (req, res) => {
    if (!req.user) return res.redirect('/');

    const { id, file } = req.params;
    if (!id || !file) return res.redirect('../instances');

    const instance = await db.get(id + '_instance').catch(err => {
        console.error('Failed to fetch instance:', err);
        return null;
    });

    if (!instance || !instance.VolumeId) return res.redirect('../instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) {
        return res.status(403).send('Unauthorized access to this instance.');
    }

    if (instance.suspended === true) {
        return res.redirect('../../instances?err=SUSPENDED');
    }

    try {
        const query = req.query.path ? `?path=${encodeURIComponent(req.query.path)}` : '';
        const url = `http://${instance.Node.address}:${instance.Node.port}/fs/${instance.VolumeId}/files/download/${encodeURIComponent(file)}${query}`;

        const response = await axios({
            method: 'get',
            url,
            auth: {
                username: 'Volq',
                password: instance.Node.apiKey
            },
            responseType: 'stream'
        });

        res.setHeader('Content-Disposition', response.headers['content-disposition'] || `attachment; filename="${encodeURIComponent(file)}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        response.data.pipe(res);
    } catch (error) {
        console.error('Error downloading file:', error.message);
        res.status(500).send('Failed to download file from node.');
    }
});

module.exports = router;
