import { describe, expect, it } from 'vitest';
import { getAbsoluteDefinitionPath } from '../src/middlewares/authentication';

describe('getAbsoluteDefinitionPath', () => {
  it('Should handle normal path joining', () => {
    expect(getAbsoluteDefinitionPath('/v1', '/users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('/api', '/posts')).toBe('/api/posts');
  });

  it('Should handle basePath without trailing slash', () => {
    expect(getAbsoluteDefinitionPath('/v1', '/users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('/api/v2', '/posts/{id}')).toBe(
      '/api/v2/posts/{id}',
    );
  });

  it('Should handle basePath with trailing slash', () => {
    expect(getAbsoluteDefinitionPath('/v1/', '/users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('/api/', '/posts')).toBe('/api/posts');
    expect(getAbsoluteDefinitionPath('/v1///', '/users')).toBe('/v1/users');
  });

  it('Should handle definitionPath without leading slash', () => {
    expect(getAbsoluteDefinitionPath('/v1', 'users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('/api', 'posts/{id}')).toBe(
      '/api/posts/{id}',
    );
  });

  it('Should prevent double slashes', () => {
    expect(getAbsoluteDefinitionPath('/v1/', '/users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('/api//', '//posts')).toBe('/api/posts');
  });

  it('Should handle empty basePath', () => {
    expect(getAbsoluteDefinitionPath('', '/users')).toBe('/users');
    expect(getAbsoluteDefinitionPath('', 'users')).toBe('/users');
  });

  it('Should ensure leading slash on result', () => {
    expect(getAbsoluteDefinitionPath('', '/users')).toBe('/users');
    expect(getAbsoluteDefinitionPath('', 'users')).toBe('/users');
    expect(getAbsoluteDefinitionPath('api', 'users')).toBe('/api/users');
  });

  it('Should return definitionPath if it already starts with basePath', () => {
    expect(getAbsoluteDefinitionPath('/v1', '/v1/users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('/api', '/api/posts/{id}')).toBe(
      '/api/posts/{id}',
    );
  });

  it('Should handle complex nested paths', () => {
    expect(getAbsoluteDefinitionPath('/api/v1', '/users/{id}/posts')).toBe(
      '/api/v1/users/{id}/posts',
    );
    expect(
      getAbsoluteDefinitionPath('/api/v2/', '/organizations/{org}/repos'),
    ).toBe('/api/v2/organizations/{org}/repos');
  });

  it('Should handle root basePath', () => {
    expect(getAbsoluteDefinitionPath('/', '/users')).toBe('/users');
    expect(getAbsoluteDefinitionPath('/', 'users')).toBe('/users');
  });

  it('Should normalize multiple consecutive slashes', () => {
    expect(getAbsoluteDefinitionPath('/v1///', '///users')).toBe('/v1/users');
    expect(getAbsoluteDefinitionPath('//api//', '/posts')).toBe('/api/posts');
  });

  it('Should avoid false positives with similar prefix paths', () => {
    // /v10/users should NOT match basePath /v1 (segment boundary check)
    expect(getAbsoluteDefinitionPath('/v1', '/v10/users')).toBe(
      '/v1/v10/users',
    );
    expect(getAbsoluteDefinitionPath('/api', '/api2/posts')).toBe(
      '/api/api2/posts',
    );
    expect(getAbsoluteDefinitionPath('/v1', '/v1a/resource')).toBe(
      '/v1/v1a/resource',
    );
  });
});
