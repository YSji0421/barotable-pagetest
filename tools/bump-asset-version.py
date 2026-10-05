"""정적 파일(css/js) 주소의 버전(?v=)을 바꾼다. GitHub Pages 캐시 때문에 새 HTML과 예전 CSS/JS가 섞이는 것을 막는다.
사용: python tools/bump-asset-version.py 20261006b   (배포할 때마다 새 값으로)"""
import io, re, glob, os, sys
VERSION = sys.argv[1]
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'barotable-pagetest', 'src', 'main', 'resources')
pat = re.compile(r'((?:href|src)="(?:\.\./)+static/(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"')
n = 0
for p in glob.glob(os.path.join(root, 'templates', '**', '*.html'), recursive=True):
    s = io.open(p, encoding='utf-8', newline='').read()
    t, k = pat.subn(lambda m: f'{m.group(1)}?v={VERSION}"', s)
    if k:
        io.open(p, 'w', encoding='utf-8', newline='').write(t)
        n += k
# common.js가 불러오는 화면 구성도 스크립트
cj = os.path.join(root, 'static', 'js', 'common.js')
s = io.open(cj, encoding='utf-8', newline='').read()
s2, k = re.subn(r"'static/js/screen-map\.js(?:\?v=[^']*)?'", f"'static/js/screen-map.js?v={VERSION}'", s)
s2, k2 = re.subn(r"'/js/screen-map\.js(?:\?v=[^']*)?'", f"'/js/screen-map.js?v={VERSION}'", s2)
io.open(cj, 'w', encoding='utf-8', newline='').write(s2)
print('templates refs', n, 'common.js refs', k + k2)
