import * as Path from "path";
import * as ts from "typescript";
import { glob } from "glob";
import * as fs from "fs";

function removeQuotes(text: string): string {
  return text.slice(1, -1);
}

/*
* Manage Reflection information for available sources
*/
export class Reflection {
  public sourceFiles: ts.SourceFile[] = [];
  public pathToSource = {};
  private pathMappings: [RegExp, string][] = [];

  addGlob(pattern?: string): Promise<any> {
    if (!pattern) {
      return;
    }

    return glob(pattern, {}).then((files) => {
      files.forEach((path) => {
        let source = fs.readFileSync(path, "utf8");
        this.add(path, source);
      });
    });
  }

  addTypingsGlob(pattern?: string): Promise<any> {
    if (!pattern) {
      return;
    }

    return glob(pattern, {}).then((files) => {
      files.forEach((path) => {
        let source = fs.readFileSync(path, "utf8");
        this.addTypings(source);
      });
    });
  }

  public addPathMappings(pathMappings: [RegExp, string][]): void {
    this.pathMappings = pathMappings;
  }

  add(path: string, source: string): ts.SourceFile {

    let parsed = Path.parse(Path.normalize(path));
    let moduleName = Path.join(parsed.dir, parsed.name);

    if (this.getSource(moduleName) !== undefined)
      return;

    let reflection = ts.createSourceFile(moduleName, source, ts.ScriptTarget.Latest, true);
    this.sourceFiles.push(reflection);
    this.pathToSource[moduleName] = reflection;

    return reflection;
  }

  addTypings(source: string) {
    let reflection = ts.createSourceFile("", source, ts.ScriptTarget.Latest, true);

    let modules = reflection.statements
      .filter(x => x.kind == ts.SyntaxKind.ModuleDeclaration)
      .map(x => <ts.ModuleDeclaration>x);

    modules.forEach(module => {
      let moduleName = module.name.getText().replace(/\'|\"|\`/g, "");
      this.pathToSource[moduleName] = module;
    });
  }

  getDeclForType(source: ts.SourceFile, typeName: string, isBase: boolean = true): ts.DeclarationStatement {
    if (!source || !typeName) return null;

    if (source.kind == ts.SyntaxKind.SourceFile) {
      let types = source.statements.filter(x =>
        x.kind == ts.SyntaxKind.ClassDeclaration ||
        x.kind == ts.SyntaxKind.InterfaceDeclaration);

      let result: ts.DeclarationStatement = null;

      if (types)
        result = <ts.DeclarationStatement>types.find(x => (<ts.DeclarationStatement>x).name.getText() === typeName);

      if (result) return result;

      if (isBase)
        result = this.getDeclForTypeFromImports(source, typeName);
      else
        result = this.getDeclForTypeFromExports(source, typeName);

      return result;
    }
    else if (source.kind == ts.SyntaxKind.ModuleDeclaration) {
      let module = <ts.ModuleDeclaration><any>source;
      let body = module.body;

      if (module.body.kind == ts.SyntaxKind.ModuleBlock) {
        let moduleBlock = <ts.ModuleBlock>body;

        let classes = moduleBlock.statements.filter(x =>
          x.kind == ts.SyntaxKind.ClassDeclaration ||
          x.kind == ts.SyntaxKind.InterfaceDeclaration);

        return <ts.DeclarationStatement>classes.find(x => (<ts.DeclarationStatement>x).name.getText() === typeName);
      }
    }
  }

  getDeclForTypeFromExports(source: ts.SourceFile, typeName: string): ts.DeclarationStatement {
    if (!source || !typeName) return null;

    let exports = source.statements.filter(
      (x): x is ts.ExportDeclaration =>
        x.kind == ts.SyntaxKind.ExportDeclaration
    );
    let symbolExportDeclarations = exports.filter(x => {
      if (!x.exportClause) {
        return true;  // export * from "module"
      }

      // export {Item} from "module"

      let exportSymbols = (<any>x).exportClause.elements;
      if (!exportSymbols) {
        return false;
      }

      let isMatch = exportSymbols.findIndex(exportSymbol => {
        return exportSymbol.name.text == typeName;
      });

      return isMatch != -1;
    });

    return symbolExportDeclarations
      .map((declaration) => {
        let exportModule = removeQuotes(declaration.moduleSpecifier.getText());
        let isRelative = exportModule.startsWith(".");
        let exportSourceModule = exportModule;

        if (isRelative) {
          let base = Path.parse(source.fileName).dir;
          exportSourceModule = Path.normalize(
            Path.join(base, `${exportModule}`)
          );
        }

        let exportSourceFile = this.getSource(exportSourceModule);

        if (!exportSourceFile) return null;

        return this.getDeclForType(exportSourceFile, typeName, false);
      })
      .find((declaration) => declaration);
  }

  getDeclForTypeFromImports(source: ts.SourceFile, typeName: string): ts.DeclarationStatement {
    if (!source || !typeName) return null;
    
    typeName = typeName.split("<")[0]; //remove Generic types variable part when read imports declarations
    
    let imports = source.statements.filter(
      (x): x is ts.ImportDeclaration =>
        x.kind == ts.SyntaxKind.ImportDeclaration
    );
    let symbolImportDecl = imports.find(x => {
      if (!x.importClause) {
        return false;  // smth like `import "module-name"`
      }
      const namedBindings = (<any>x).importClause.namedBindings;
      if (!namedBindings) {
        return false; // smth like `import defaultMember from "module-name";`;
      }
      let importSymbols = namedBindings.elements;
      if (!importSymbols) {
        return false; // smth like `import * as name from "module-name"`
      }
      let isMatch = importSymbols.findIndex(importSymbol => {
        return importSymbol.name.text == typeName;
      });

      return isMatch != -1;
    });

    if (!symbolImportDecl)
      return null;

    let importModule = removeQuotes(symbolImportDecl.moduleSpecifier.getText());
    let isRelative = importModule.startsWith(".");
    let inportSourceModule = importModule;

    if (isRelative) {
      let base = Path.parse(source.fileName).dir;
      inportSourceModule = Path.normalize(Path.join(base, `${importModule}`));
    }
    inportSourceModule = this.pathMappings.reduce(
      (currentModule, [pattern, replacement]) =>
        currentModule.replace(pattern, replacement),
      inportSourceModule
    );

    let inportSourceFile = this.getSource(inportSourceModule);

    if (!inportSourceFile)
      return null;

    return this.getDeclForType(inportSourceFile, typeName, false);
  }

  public resolveClassElementType(node: ts.ClassElement): ts.TypeNode {
    if (!node) return null;
    switch (node.kind) {
      case ts.SyntaxKind.PropertyDeclaration:
        let prop = <ts.PropertyDeclaration>node;
        return prop.type;
      case ts.SyntaxKind.MethodDeclaration:
        let meth = <ts.MethodDeclaration>node;
        return meth.type;
      case ts.SyntaxKind.GetAccessor:
        let get = <ts.GetAccessorDeclaration>node;
        return get.type;
      default:
        // console.log(`unhandled kind ${ts.SyntaxKind[node.kind]} in resolveClassElementType`);
        return null;
    }
  }

  public resolveTypeElementType(node: ts.TypeElement): ts.TypeNode {
    if (!node) return null;
    switch (node.kind) {
      case ts.SyntaxKind.PropertySignature:
        let prop = <ts.PropertySignature>node;
        return prop.type;
      case ts.SyntaxKind.MethodSignature:
        let meth = <ts.MethodSignature>node;
        return meth.type;
      default:
        //console.log(`unhandled kind ${ts.SyntaxKind[node.kind]} in resolveTypeElementType`);
        return null;
    }
  }

  public resolveTypeName(node: ts.TypeNode): string {
    if (!node) return null;
    switch (node.kind) {
      case ts.SyntaxKind.ArrayType:
        let arr = <ts.ArrayTypeNode>node;
        return this.resolveTypeName(arr.elementType);
      case ts.SyntaxKind.TypeReference:
        let ref = <ts.TypeReferenceNode>node;
        if (ref.typeName.getText() == "Array") {
          return this.resolveTypeName(ref.typeArguments[0]);
        }
        return ref.typeName.getText();
      case ts.SyntaxKind.StringKeyword:
        return "string";
      case ts.SyntaxKind.NumberKeyword:
        return "number";
      case ts.SyntaxKind.BooleanKeyword:
        return "boolean";
      default:
        //console.log(`unhandled kind ${ts.SyntaxKind[node.kind]} in resolveTypeName`);
        return null;
    }
  }

  private getSource(moduleName: string): ts.SourceFile {
    return (
      this.pathToSource[moduleName] ?? this.pathToSource[`${moduleName}/index`]
    );
  }
}
