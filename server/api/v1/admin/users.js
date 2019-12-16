const express = require('express');
const router = express.Router();
const authMiddleware = require('../../../middlewares/authMiddleware');
const userManagementService = require('../../../services/admin/userManagementService');

router.get('/', authMiddleware.authenticateAsAdminUser, async function(
    req,
    res,
    next,
) {
    try {
        let params = req.query;
        let results = await userManagementService.getUserList(params, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

router.get(
    '/adminUsers',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.query;
            let results = await userManagementService.listUsersInAdminGroup(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.get(
    '/editorUsers',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.query;
            let results = await userManagementService.listUsersInEditorGroup(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.get(
    '/viewerUsers',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.query;
            let results = await userManagementService.listUsersInViewerGroup(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/moveUserToAdminGroup',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.moveUserToAdminGroup(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/moveUserToViewerGroup',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.moveUserToViewerGroup(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/moveUserToEditorGroup',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.moveUserToEditorGroup(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/enableUser',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.enableUser(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/disableUser',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.disableUser(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/deleteUser',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.deleteUser(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

router.post(
    '/inviteUser',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let params = req.body;
            let results = await userManagementService.inviteUser(
                params,
                req.user,
            );
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

module.exports = router;
