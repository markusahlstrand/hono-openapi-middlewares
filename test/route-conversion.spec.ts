import { describe, expect, it } from 'vitest';
import { convertRouteSyntax } from '../src/middlewares/authentication';

describe('convertRouteSyntax', () => {
  it('Should convert simple route parameters', () => {
    expect(convertRouteSyntax('/users/:id')).toBe('/users/{id}');
    expect(convertRouteSyntax('/users/:userId/posts/:postId')).toBe(
      '/users/{userId}/posts/{postId}',
    );
  });

  it('Should handle optional parameters', () => {
    expect(convertRouteSyntax('/users/:id?')).toBe('/users/{id}');
    expect(convertRouteSyntax('/posts/:id?/comments')).toBe(
      '/posts/{id}/comments',
    );
  });

  it('Should handle typed parameters (regex constraints)', () => {
    expect(convertRouteSyntax('/users/:id{[0-9]+}')).toBe('/users/{id}');
    expect(convertRouteSyntax('/posts/:slug{[a-z-]+}')).toBe('/posts/{slug}');
  });

  it('Should handle typed optional parameters', () => {
    expect(convertRouteSyntax('/users/:id{[0-9]+}?')).toBe('/users/{id}');
    expect(convertRouteSyntax('/posts/:id{[0-9]+}?/edit')).toBe(
      '/posts/{id}/edit',
    );
  });

  it('Should handle multiple parameters with different types', () => {
    expect(convertRouteSyntax('/api/:version{v[0-9]+}/users/:id{[0-9]+}')).toBe(
      '/api/{version}/users/{id}',
    );
  });

  it('Should handle complex regex patterns in type constraints', () => {
    expect(convertRouteSyntax('/files/:filename{.+\\.(jpg|png)}')).toBe(
      '/files/{filename}',
    );
  });

  it('Should not modify routes without parameters', () => {
    expect(convertRouteSyntax('/users')).toBe('/users');
    expect(convertRouteSyntax('/api/v1/posts')).toBe('/api/v1/posts');
  });

  it('Should handle routes with mixed static and dynamic segments', () => {
    expect(convertRouteSyntax('/api/v1/:resource/:id{[0-9]+}/details')).toBe(
      '/api/v1/{resource}/{id}/details',
    );
  });

  it('Should handle parameter names with underscores', () => {
    expect(convertRouteSyntax('/users/:user_id')).toBe('/users/{user_id}');
    expect(convertRouteSyntax('/posts/:post_id{[0-9]+}')).toBe(
      '/posts/{post_id}',
    );
  });

  it('Should handle edge case of consecutive parameters', () => {
    expect(convertRouteSyntax('/:org/:repo')).toBe('/{org}/{repo}');
    expect(convertRouteSyntax('/:org{[a-z]+}/:repo{[a-z-]+}')).toBe(
      '/{org}/{repo}',
    );
  });
});
