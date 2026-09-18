import ts from 'typescript';
import fs from 'node:fs';
const configPath = ts.findConfigFile('.', ts.sys.fileExists);
const raw = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, '.');
const host = {
  getScriptFileNames: () => parsed.fileNames,
  getScriptVersion: () => '1',
  getScriptSnapshot: (file) =>
    fs.existsSync(file) ? ts.ScriptSnapshot.fromString(fs.readFileSync(file, 'utf8')) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
};
const service = ts.createLanguageService(host);
for (const fileName of parsed.fileNames) {
  for (const change of service.organizeImports({ type: 'file', fileName }, {}, {})) {
    let text = fs.readFileSync(change.fileName, 'utf8');
    for (const edit of [...change.textChanges].sort((a, b) => b.span.start - a.span.start))
      text =
        text.slice(0, edit.span.start) +
        edit.newText +
        text.slice(edit.span.start + edit.span.length);
    fs.writeFileSync(change.fileName, text);
  }
}
service.dispose();
console.log('Imports organized.');
