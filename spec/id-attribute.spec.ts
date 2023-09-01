"use strict";

import { Linter, Rule } from 'template-lint';
import { Config } from '@base/config';
import { AureliaLinter } from '@base/aurelia-linter';
import { BindingRule } from '@base/rules/binding';
import { Reflection } from '@base/reflection';
import { initialize } from 'aurelia-pal-nodejs';

initialize();

describe("ID Attribute Rule", () => {
  //uncomment, add your example and what you expect. 

  it("will reject empty id", (done) => {
    var config: Config = new Config();
    var linter: AureliaLinter = new AureliaLinter(config);
    var html = `
    <template>
       <div id=""></div>
    </template>`;

    linter.lint(html)
      .then((issues) => {
        try {
          expect(issues.length).toBe(1);
        }
        catch (err) { fail(err); }
        finally { done(); }
      });
  });

  it("will reject bad id", (done) => {
    var config: Config = new Config();
    var linter: AureliaLinter = new AureliaLinter(config);
    var html = `
    <template>
       <div id="£"></div>
    </template>`;

    linter.lint(html)
      .then((issues) => {
        try {
          expect(issues.length).toBe(1);
        }
        catch (err) { fail(err); }
        finally { done(); }
      });
  });

  it("will allow interpolated (aurelia) id", (done) => {
    var config: Config = new Config();
    var linter: AureliaLinter = new AureliaLinter(config);
    var html = `
    <template>
       <div id="\${boo}"></div>
    </template>`;

    linter.lint(html)
      .then((issues) => {
        try {
          expect(issues.length).toBe(0);
        }
        catch (err) { fail(err); }
        finally { done(); }
      });
  });

  it("will reject duplicated id", (done) => {
    var config: Config = new Config();
    var linter: AureliaLinter = new AureliaLinter(config);
    var html = `
    <template>
       <div id="boo"></div>
       <div id="boo"></div>
    </template>`;

    linter.lint(html)
      .then((issues) => {
        try {
          expect(issues.length).toBe(1);
        }
        catch (err) { fail(err); }
        finally { done(); }
      });
  });

  it("will allow duplicate interpolated id", (done) => {
    var config: Config = new Config();
    var linter: AureliaLinter = new AureliaLinter(config);
    var html = `
    <template>
       <div id="\${boo}"></div>
       <div id="\${boo}"></div>
    </template>`;

    linter.lint(html)
      .then((issues) => {
        try {
          expect(issues.length).toBe(0);
        }
        catch (err) { fail(err); }
        finally { done(); }
      });
  });
});
