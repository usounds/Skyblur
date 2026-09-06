import { describe, it, expect } from 'vitest';
import { generateMarkdownForPath } from '../markdownForAgents';

describe('markdownForAgents', () => {
  describe('generateMarkdownForPath', () => {
    it('generates Home markdown in Japanese for "/" and "/ja"', () => {
      const rootResult = generateMarkdownForPath('/');
      const jaResult = generateMarkdownForPath('/ja');

      expect(rootResult).not.toBeNull();
      expect(jaResult).not.toBeNull();
      expect(rootResult?.markdown).toContain('# Skyblurへようこそ');
      expect(rootResult?.markdown).toContain('title: "Skyblur');
      expect(rootResult?.markdown).toContain('image: "https://skyblur.uk/ogp.png"');
      expect(jaResult?.markdown).toEqual(rootResult?.markdown);
    });

    it('generates Home markdown in English for "/en"', () => {
      const enResult = generateMarkdownForPath('/en');

      expect(enResult).not.toBeNull();
      expect(enResult?.markdown).toContain('# Welcome to Skyblur');
      expect(enResult?.markdown).toContain('Masked (Blur / Spoiler) Posting');
    });

    it('generates Features markdown for "/ja/features" and "/features"', () => {
      const jaFeatures = generateMarkdownForPath('/ja/features');
      const defaultFeatures = generateMarkdownForPath('/features');

      expect(jaFeatures).not.toBeNull();
      expect(jaFeatures?.markdown).toContain('# 機能紹介・限定公開の仕組み');
      expect(jaFeatures?.markdown).toContain('全体公開');
      expect(jaFeatures?.markdown).toContain('フォロワー限定');
      expect(defaultFeatures?.markdown).toEqual(jaFeatures?.markdown);
    });

    it('generates Features markdown in English for "/en/features"', () => {
      const enFeatures = generateMarkdownForPath('/en/features');

      expect(enFeatures).not.toBeNull();
      expect(enFeatures?.markdown).toContain('# Features & Visibility Settings');
      expect(enFeatures?.markdown).toContain('Followers Only');
    });

    it('generates Terms markdown for "/ja/termofuse" and "/en/termofuse"', () => {
      const jaTerms = generateMarkdownForPath('/ja/termofuse');
      const enTerms = generateMarkdownForPath('/en/termofuse');

      expect(jaTerms).not.toBeNull();
      expect(jaTerms?.markdown).toContain('プライバシーポリシー');
      expect(enTerms).not.toBeNull();
      expect(enTerms?.markdown).toContain('Terms of Use');
    });

    it('returns null for unsupported paths', () => {
      expect(generateMarkdownForPath('/unknown-path')).toBeNull();
      expect(generateMarkdownForPath('/api/oauth/session')).toBeNull();
    });
  });
});
