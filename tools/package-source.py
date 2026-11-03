#!/usr/bin/env python3
"""Export reviewed source with checksums; never include dependencies or local runtime data."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'release' / 'xiaoying-studio-source.zip'
TOP_LEVEL = {'.github', 'frontend', 'backend', 'database', 'docs', 'tools'}
ROOT_FILES = {'README.md', 'compose.yaml', '.env.example', '.gitignore', '.gitattributes'}
EXCLUDED = {'.git', 'node_modules', '.next', 'target', 'out', 'coverage', 'storage', 'release', 'backups', '__pycache__', '.idea', '.vscode'}
REQUIRED = {
    'README.md', '.env.example', '.github/workflows/ci.yml', 'compose.yaml',
    'frontend/package.json', 'frontend/package-lock.json', 'frontend/Dockerfile',
    'frontend/scripts/next.mjs', 'frontend/src/app/layout.tsx', 'frontend/src/app/history/page.tsx',
    'backend/pom.xml', 'backend/Dockerfile', 'backend/src/main/resources/application.yml',
    'backend/src/main/java/com/xiaoying/studio/StudioApplication.java',
    'database/init/001-schema.sql', 'database/init/002-seed.sql',
    'database/init/003-identity-assets.sql', 'database/init/004-demo-users.sql', 'database/init/005-tasks.sql',
    'backend/src/main/resources/static/demo/sample-1.png', 'backend/src/main/resources/static/demo/sample-2.png',
    'docs/delivery.md', 'docs/system-acceptance.md', 'tools/package-source.py',
}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def add_file(archive, name, data):
    info = zipfile.ZipInfo('xiaoying-studio/' + name, date_time=(1980, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, data)


def allowed(name):
    path = Path(name)
    if not path.parts or (path.parts[0] not in TOP_LEVEL and name not in ROOT_FILES):
        return False
    if any(part in EXCLUDED for part in path.parts):
        return False
    if path.name.startswith('.env') and path.name != '.env.example':
        return False
    return not (path.name == '.DS_Store' or path.suffix in {'.log', '.cookies', '.tsbuildinfo', '.pyc', '.zip'})


def main():
    names = sorted({name.decode('utf-8') for name in git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split(b'\0') if name})
    names = [name for name in names if allowed(name)]
    missing = REQUIRED - set(names)
    if missing:
        raise SystemExit('Missing required source files: ' + ', '.join(sorted(missing)))
    payload = {}
    for name in names:
        source = ROOT / name
        if source.is_symlink() or not source.is_file():
            raise SystemExit('Expected a regular source file: ' + name)
        payload[name] = source.read_bytes()
    # Check that Docker contexts and public sample resources are actually included.
    if len([name for name in names if name.startswith('backend/src/main/resources/static/demo/') and name.endswith('.svg')]) != 6:
        raise SystemExit('Expected six local template covers')
    changed = bool(git('status', '--porcelain', '--untracked-files=all').strip())
    info = {
        'format': 1,
        'project': 'xiaoying-studio',
        'git_head': git('rev-parse', 'HEAD').decode().strip(),
        'working_tree_clean': not changed,
        'snapshot': 'commit' if not changed else 'working-tree',
        'note': 'git_head identifies the source commit only when working_tree_clean is true; file hashes identify this exact export.',
        'file_count': len(payload),
        'sha256': {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix('.zip.tmp')
    try:
        with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in payload.items():
                add_file(archive, name, data)
            add_file(archive, 'SOURCE_INFO.json', json.dumps(info, ensure_ascii=False, indent=2) + '\n')
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise SystemExit('Archive CRC check failed')
            for name, data in payload.items():
                if archive.read('xiaoying-studio/' + name) != data:
                    raise SystemExit('Archive payload mismatch: ' + name)
        temporary.replace(OUTPUT)
    finally:
        temporary.unlink(missing_ok=True)
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix('.zip.sha256').write_text(digest + '  ' + OUTPUT.name + '\n', encoding='utf-8')
    print(json.dumps({'archive': str(OUTPUT), 'bytes': OUTPUT.stat().st_size, 'source_files': len(payload),
                      'git_head': info['git_head'], 'working_tree_clean': not changed, 'sha256': digest}, ensure_ascii=False))


if __name__ == '__main__':
    main()
