import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/idempotency/idempotencyKey.model.js', () => ({
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

const idempotencyKeyModel = (await import('../src/modules/idempotency/idempotencyKey.model.js'))
  .default;
const { idempotency } = await import('../src/middlewares/idempotencyMiddleware.js');

describe('idempotencyMiddleware', () => {
  const machineContext = {
    domain: 'project-1',
    principalType: 'ProjectMachine',
    credentialId: 'cred-1',
  };
  const runtimeContext = {
    domain: 'project-1',
    principalType: 'ProjectRuntime',
    credentialId: 'cred-1',
    externalUserId: 'sabik',
  };

  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { get: jest.fn(), projectContext: machineContext };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  test('no Idempotency-Key header: complete no-op, never touches the model', async () => {
    req.get.mockReturnValue(undefined);

    await idempotency()(req, res, next);

    expect(idempotencyKeyModel.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  test("no req.projectContext (shouldn't happen post-auth, but defensive): no-ops", async () => {
    req.get.mockReturnValue('key-1');
    req.projectContext = undefined;

    await idempotency()(req, res, next);

    expect(idempotencyKeyModel.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  test('key present, no prior response: lets the request through and persists the response the controller sends', async () => {
    req.get.mockReturnValue('key-1');
    idempotencyKeyModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });
    idempotencyKeyModel.create.mockResolvedValue({});

    await idempotency()(req, res, next);

    expect(idempotencyKeyModel.findOne).toHaveBeenCalledWith({
      cacheKey: 'project-1:cred-1:key-1',
    });
    expect(next).toHaveBeenCalledWith();

    // Simulate the real controller responding.
    res.statusCode = 201;
    res.json({ success: true, data: { _id: 'a1' } });

    expect(idempotencyKeyModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheKey: 'project-1:cred-1:key-1',
        statusCode: 201,
        body: { success: true, data: { _id: 'a1' } },
      })
    );
  });

  test('key present, prior response exists: replays it and never calls next()', async () => {
    req.get.mockReturnValue('key-1');
    idempotencyKeyModel.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          statusCode: 201,
          body: { success: true, data: { _id: 'a1' } },
        }),
    });

    await idempotency()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { _id: 'a1' } });
    expect(next).not.toHaveBeenCalled();
  });

  test('scopes the cache key by externalUserId for a ProjectRuntimeContext', async () => {
    req.get.mockReturnValue('key-1');
    req.projectContext = runtimeContext;
    idempotencyKeyModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    await idempotency()(req, res, next);

    expect(idempotencyKeyModel.findOne).toHaveBeenCalledWith({
      cacheKey: 'project-1:cred-1:sabik:key-1',
    });
  });

  test('a cache lookup failure does not block the real request', async () => {
    req.get.mockReturnValue('key-1');
    idempotencyKeyModel.findOne.mockReturnValue({
      lean: () => Promise.reject(new Error('mongo down')),
    });

    await idempotency()(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
