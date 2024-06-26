import { Reflection } from "@base/reflection";

let model: Reflection;

beforeEach(() => {
  model = new Reflection();
});

describe("getDeclForType", () => {
  it("resolve directory import", async () => {
    const base = `
    export class Base{
      base:string;
    }`;

    const viewmodel = `
    import {Base} from "./submodule"
    class Value extends Base{
    }
    export class Foo{
      value:Value;
    }`;

    const viewModelSource = model.add("./foo.ts", viewmodel);
    const baseSource = model.add("./submodule/index.ts", base);

    const result = model.getDeclForType(viewModelSource, "Base")

    expect(result).not.toBeNull();
    expect(result).toBe(baseSource.statements.at(0));
  });
  it("resolve directory export", async () => {
    const base = `
    export class Base{
      base:string;
    }`;
    const exporter = `
      export * from "./submodule";
    `;

    const viewmodel = `
    import {Base} from "./exporter"
    class Value extends Base{
    }
    export class Foo{
      value:Value;
    }`;

    const viewModelSource = model.add("./foo.ts", viewmodel);
    const baseSource = model.add("./submodule/index.ts", base);
    model.add("./exporter", exporter);

    const result = model.getDeclForType(viewModelSource, "Base")

    expect(result).not.toBeNull();
    expect(result).toBe(baseSource.statements.at(0));
  });
  it("resolve second directory export", async () => {
    const base = `
    export class Base{
      base:string;
    }`;
    const exporter = `
      export * from "./foo";
      export * from "./submodule";
    `;

    const viewmodel = `
    import {Base} from "./exporter"
    class Value extends Base{
    }
    export class Foo{
      value:Value;
    }`;

    const viewModelSource = model.add("./foo.ts", viewmodel);
    const baseSource = model.add("./submodule/index.ts", base);
    model.add("./exporter", exporter);

    const result = model.getDeclForType(viewModelSource, "Base")

    expect(result).not.toBeNull();
    expect(result).toBe(baseSource.statements.at(0));
  });
  test("support reexport from import", () => {
    const base = `
    export class Base{
      base:string;
    }`;
    const reexporter = `
      import { Base } from "./base";
      export { Base };
    `;

    const viewmodel = `
    import {Base} from "./reexporter"
    class Value extends Base{
    }
    export class Foo{
      value:Value;
    }`;

    const viewModelSource = model.add("./foo.ts", viewmodel);
    const baseSource = model.add("./base", base);
    model.add("./reexporter", reexporter);

    const result = model.getDeclForType(viewModelSource, "Base")

    expect(result).not.toBeNull();
    expect(result).toBe(baseSource.statements.at(0));
  });
});
