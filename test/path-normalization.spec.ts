import { describe, expect, it } from 'vitest';
import { normalizePath } from '../src/middlewares/authentication';

describe('normalizePath', () => {
  it('Should handle normal paths', () => {
    expect(normalizePath('/users')).toBe('/users');
    expect(normalizePath('/api/v1/users')).toBe('/api/v1/users');
  });

  it('Should remove trailing slashes', () => {
    expect(normalizePath('/users/')).toBe('/users');
    expect(normalizePath('/api/v1/')).toBe('/api/v1');
    expect(normalizePath('/users///')).toBe('/users');
  });

  it('Should handle root path', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('///')).toBe('/');
  });

  it('Should collapse multiple consecutive slashes', () => {
    expect(normalizePath('/users//posts')).toBe('/users/posts');
    expect(normalizePath('//api///v1////users')).toBe('/api/v1/users');
    expect(normalizePath('/users///123//comments')).toBe('/users/123/comments');
  });

  it('Should add leading slash if missing', () => {
    expect(normalizePath('users')).toBe('/users');
    expect(normalizePath('api/v1/users')).toBe('/api/v1/users');
  });

  it('Should handle empty string', () => {
    expect(normalizePath('')).toBe('/');
  });

  it('Should handle paths with parameters', () => {
    expect(normalizePath('/users/{id}')).toBe('/users/{id}');
    expect(normalizePath('/users/{id}/')).toBe('/users/{id}');
    expect(normalizePath('/users//{id}//posts')).toBe('/users/{id}/posts');
  });

  it('Should handle complex paths', () => {
    expect(normalizePath('/api//v1///users/{userId}//posts/{postId}/')).toBe(
      '/api/v1/users/{userId}/posts/{postId}',
    );
  });

  it('Should be idempotent', () => {
    const path = '/users/{id}/posts';
    const normalized = normalizePath(path);
    expect(normalizePath(normalized)).toBe(normalized);
  });

  it('Should handle paths with mixed slashes', () => {
    expect(normalizePath('users/')).toBe('/users');
    expect(normalizePath('users//')).toBe('/users');
    expect(normalizePath('//users')).toBe('/users');
  });
});
