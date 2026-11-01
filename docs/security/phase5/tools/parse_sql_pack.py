"""Syntax check of the phase 5 SQL pack with the Postgres grammar (libpg_query through pglast).

It parses; it does not execute and it does not resolve names. A pass means: the text is valid Postgres 17 syntax, every
statement is one the grammar knows, and the PL/pgSQL bodies of DO blocks and functions are valid PL/pgSQL. It says nothing
about whether a table, column or role exists.

usage: parse_sql_pack.py FILE.sql [FILE.sql ...]
"""
import sys

import pglast
from pglast import ast


def plpgsql_bodies(stmts):
    """Yield (label, wrapped CREATE FUNCTION text) for every DO block and every plpgsql CREATE FUNCTION."""
    for raw in stmts:
        node = raw.stmt
        if isinstance(node, ast.DoStmt):
            lang = 'plpgsql'
            body = None
            for arg in node.args or ():
                if arg.defname == 'language':
                    lang = arg.arg.sval
                if arg.defname == 'as':
                    body = arg.arg.sval
            if lang == 'plpgsql' and body is not None:
                yield 'DO block', 'CREATE FUNCTION pg_temp.__do() RETURNS void LANGUAGE plpgsql AS $__b__$' + body + '$__b__$;'
        elif isinstance(node, ast.CreateFunctionStmt):
            options = {o.defname: o.arg for o in (node.options or ())}
            lang = options['language'].sval if 'language' in options else None
            if lang == 'plpgsql':
                name = '.'.join(n.sval for n in node.funcname)
                yield 'function ' + name, None  # parsed from the original text below


def main(paths):
    failures = 0
    for path in paths:
        text = open(path, encoding='utf-8').read()
        try:
            stmts = pglast.parse_sql(text)
        except pglast.parser.ParseError as e:
            print(f'FAIL  {path}: SQL: {e}')
            failures += 1
            continue
        kinds = {}
        for raw in stmts:
            k = type(raw.stmt).__name__
            kinds[k] = kinds.get(k, 0) + 1
        checked = 0
        bad = False
        for label, wrapped in plpgsql_bodies(stmts):
            try:
                if wrapped is None:
                    # a plpgsql CREATE FUNCTION: parse its own text (the statement's slice of the file)
                    raw = next(r for r in stmts if isinstance(r.stmt, ast.CreateFunctionStmt)
                               and '.'.join(n.sval for n in r.stmt.funcname) == label.split(' ', 1)[1])
                    seg = text[raw.stmt_location:raw.stmt_location + raw.stmt_len] if raw.stmt_len else text[raw.stmt_location:]
                    pglast.parse_plpgsql(seg)
                else:
                    pglast.parse_plpgsql(wrapped)
                checked += 1
            except pglast.parser.ParseError as e:
                print(f'FAIL  {path}: PL/pgSQL in {label}: {e}')
                failures += 1
                bad = True
        if not bad:
            summary = ', '.join(f'{n} {k}' for k, n in sorted(kinds.items()))
            print(f'ok    {path}: {len(stmts)} statements ({summary}); {checked} PL/pgSQL bodies parsed')
    print(f'--- {len(paths)} files, {failures} failure(s)')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
