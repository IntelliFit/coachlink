import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// On Android a numeric input's native text layer rises by the ScrollView's scroll distance.
// Forms use page scroll; dialogs and cards use a View with overflow-y: auto.
const WECHAT_SRC = join(process.cwd(), 'apps/wechat/src');
const INPUT_TAGS = new Set(['Input', 'StableInput', 'TaroInput', 'NutInput', 'StableNutInput']);

type WechatModule = {
  source: ts.SourceFile;
  imports: Map<string, string>;
  locals: Map<string, ts.Node>;
};

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

function resolveImport(fromFile: string, specifier: string) {
  let base: string;
  if (specifier.startsWith('@/')) base = join(WECHAT_SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;
  return [`${base}.tsx`, join(base, 'index.tsx')].find((candidate) => existsSync(candidate)) ?? null;
}

function loadModule(file: string): WechatModule {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map<string, string>();
  const locals = new Map<string, ts.Node>();
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const target = resolveImport(file, (node.moduleSpecifier as ts.StringLiteral).text);
      const { name, namedBindings } = node.importClause;
      if (target && name) imports.set(name.text, target);
      if (target && namedBindings && ts.isNamedImports(namedBindings)) {
        namedBindings.elements.forEach((element) => imports.set(element.name.text, target));
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      locals.set(node.name.text, node.initializer);
    }
    if (ts.isFunctionDeclaration(node) && node.name) locals.set(node.name.text, node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { source, imports, locals };
}

function getOpeningElement(node: ts.Node) {
  if (ts.isJsxElement(node)) return node.openingElement;
  return ts.isJsxSelfClosingElement(node) ? node : null;
}

function isNumericInput(element: ts.JsxOpeningLikeElement) {
  if (!INPUT_TAGS.has(element.tagName.getText())) return false;
  const typeAttribute = element.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.getText() === 'type',
  ) as ts.JsxAttribute | undefined;
  const typeText = typeAttribute?.initializer?.getText() ?? '';
  if (/digit|number/.test(typeText)) return true;
  return typeText.startsWith('{') && !/text|password/.test(typeText);
}

function findScrollViewsWithNumericInput(modules: Map<string, WechatModule>) {
  const reachesNumericInput = (file: string, root: ts.Node, seen: Set<string>): boolean => {
    const wechatModule = modules.get(file)!;
    const follow = (name: string) => {
      const local = wechatModule.locals.get(name);
      const localKey = `${file}#${name}`;
      if (local && !seen.has(localKey)) {
        seen.add(localKey);
        return reachesNumericInput(file, local, seen);
      }
      const imported = wechatModule.imports.get(name);
      if (imported && !seen.has(imported)) {
        seen.add(imported);
        return reachesNumericInput(imported, modules.get(imported)!.source, seen);
      }
      return false;
    };
    const visit = (node: ts.Node): boolean => {
      const opening = getOpeningElement(node);
      if (opening && (isNumericInput(opening) || follow(opening.tagName.getText()))) return true;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && follow(node.expression.text)) return true;
      return ts.forEachChild(node, visit) ?? false;
    };
    return visit(root);
  };

  const violations: string[] = [];
  modules.forEach((wechatModule, file) => {
    const visit = (node: ts.Node) => {
      if (getOpeningElement(node)?.tagName.getText() === 'ScrollView' && reachesNumericInput(file, node, new Set())) {
        const line = wechatModule.source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        violations.push(`${relative(WECHAT_SRC, file).replace(/\\/g, '/')}:${line}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(wechatModule.source);
  });
  return violations.sort();
}

describe('wechat numeric inputs and ScrollView', () => {
  it('never renders a numeric input inside a ScrollView', () => {
    const modules = new Map(listTsxFiles(WECHAT_SRC).map((file) => [file, loadModule(file)]));
    expect(findScrollViewsWithNumericInput(modules)).toEqual([]);
  });
});
