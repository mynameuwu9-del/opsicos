describe('Auth Middleware', () => {
  let isAuthenticated, isNotAuthenticated, checkBanned;
  let req, res, next;

  beforeEach(() => {
    // Reset module cache to get fresh imports
    jest.resetModules();

    // Mock dependencies before requiring the module
    jest.mock('../src/models/BanList', () => ({
      findOne: jest.fn(),
    }));
    jest.mock('../src/services/ipInfoService', () => ({
      getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
    }));
    jest.mock('../src/config/logger', () => ({
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    }));

    const auth = require('../src/middleware/auth');
    isAuthenticated = auth.isAuthenticated;
    isNotAuthenticated = auth.isNotAuthenticated;
    checkBanned = auth.checkBanned;

    next = jest.fn();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    };
    req = {
      isAuthenticated: jest.fn(),
      xhr: false,
      headers: { accept: 'text/html' },
      user: null,
      session: { destroy: jest.fn() },
      logout: jest.fn((cb) => cb()),
    };
  });

  describe('isAuthenticated', () => {
    test('should call next() when user is authenticated', () => {
      req.isAuthenticated.mockReturnValue(true);
      isAuthenticated(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should return 401 JSON for unauthenticated XHR requests', () => {
      req.isAuthenticated.mockReturnValue(false);
      req.xhr = true;
      isAuthenticated(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 JSON for unauthenticated JSON accept header', () => {
      req.isAuthenticated.mockReturnValue(false);
      req.headers.accept = 'application/json';
      isAuthenticated(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should redirect to /login for unauthenticated page requests', () => {
      req.isAuthenticated.mockReturnValue(false);
      isAuthenticated(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith('/login');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('isNotAuthenticated', () => {
    test('should call next() when user is NOT authenticated', () => {
      req.isAuthenticated.mockReturnValue(false);
      isNotAuthenticated(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should redirect to /dashboard when user IS authenticated', () => {
      req.isAuthenticated.mockReturnValue(true);
      isNotAuthenticated(req, res, next);
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkBanned', () => {
    test('should call next() when user is not authenticated', async () => {
      req.isAuthenticated.mockReturnValue(false);
      await checkBanned(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should call next() when user has no ban records', async () => {
      req.isAuthenticated.mockReturnValue(true);
      req.user = { email: 'test@test.com' };

      const BanList = require('../src/models/BanList');
      BanList.findOne.mockResolvedValue(null);

      await checkBanned(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('should block banned user and logout', async () => {
      req.isAuthenticated.mockReturnValue(true);
      req.user = { email: 'banned@test.com' };
      req.headers.accept = 'application/json';

      const BanList = require('../src/models/BanList');
      BanList.findOne
        .mockResolvedValueOnce({ type: 'email', value: 'banned@test.com' })
        .mockResolvedValueOnce(null);

      await checkBanned(req, res, next);
      expect(req.logout).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
