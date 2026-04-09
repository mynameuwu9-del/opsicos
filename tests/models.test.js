const {
  AI_MODELS,
  MODEL_IDS,
  MODEL_DISPLAY_NAMES,
  MODEL_ID_TO_NAME,
  MODEL_NAME_TO_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_NAME,
} = require('../src/config/models');

describe('AI Models Registry', () => {
  test('should export a non-empty array of models', () => {
    expect(Array.isArray(AI_MODELS)).toBe(true);
    expect(AI_MODELS.length).toBeGreaterThan(0);
  });

  test('every model should have required fields', () => {
    for (const model of AI_MODELS) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('logo');
      expect(typeof model.id).toBe('string');
      expect(typeof model.name).toBe('string');
      expect(model.id.length).toBeGreaterThan(0);
      expect(model.name.length).toBeGreaterThan(0);
    }
  });

  test('model IDs should be unique', () => {
    const ids = new Set(MODEL_IDS);
    expect(ids.size).toBe(MODEL_IDS.length);
  });

  test('display names should be unique', () => {
    const names = new Set(MODEL_DISPLAY_NAMES);
    expect(names.size).toBe(MODEL_DISPLAY_NAMES.length);
  });

  test('MODEL_ID_TO_NAME should map every model ID to its name', () => {
    for (const model of AI_MODELS) {
      expect(MODEL_ID_TO_NAME[model.id]).toBe(model.name);
    }
  });

  test('MODEL_NAME_TO_ID should map every display name to its ID', () => {
    for (const model of AI_MODELS) {
      expect(MODEL_NAME_TO_ID[model.name]).toBe(model.id);
    }
  });

  test('default model ID should be in the model list', () => {
    expect(MODEL_IDS).toContain(DEFAULT_MODEL_ID);
  });

  test('default model name should be in the display names list', () => {
    expect(MODEL_DISPLAY_NAMES).toContain(DEFAULT_MODEL_NAME);
  });

  test('default model ID and name should correspond', () => {
    expect(MODEL_ID_TO_NAME[DEFAULT_MODEL_ID]).toBe(DEFAULT_MODEL_NAME);
  });
});
