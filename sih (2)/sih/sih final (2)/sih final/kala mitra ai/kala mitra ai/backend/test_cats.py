import re
from collections import Counter

txt = open('src/services/marketplaceService.js', encoding='utf-8').read()
counts = Counter(re.findall(r'craft_type:\s*"([^"]+)"', txt))
for k, v in counts.items():
    print(f"{k}: {v}")
