import * as fs from 'fs';

export class Serde {
  static toString<T>(obj: T): string {
    return JSON.stringify(obj, null, 4);
  }

  static toFile<T>(obj: T, path: string) {
    fs.writeFileSync(path, Serde.toString(obj), 'utf8');
  }

  static fromString<T>(json: string): T {
    return JSON.parse(json);
  }

  static fromFile<T>(path: string): T {
    return Serde.fromString(fs.readFileSync(path, 'utf8'));
  }
}
