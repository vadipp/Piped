#!/bin/bash
set -euo pipefail
# Pin fonts from their official repositories; no apt mirror is needed here.
font_dir="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/piped-tests"
mkdir -p "$font_dir"
font_commit=ffebf8c1ee449e544955a7e813c54f9b73848eac
emoji_commit=99701e07d3d1fe1bdbcdb14964547f0fd592966f
for file in NotoSans-Regular.ttf NotoSans-Bold.ttf; do
  curl -fLsS --max-time 30 "https://raw.githubusercontent.com/notofonts/noto-fonts/$font_commit/hinted/ttf/NotoSans/$file" -o "$font_dir/$file"
done
curl -fLsS --max-time 30 "https://raw.githubusercontent.com/notofonts/noto-fonts/$font_commit/hinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf" -o "$font_dir/NotoSansSymbols2-Regular.ttf"
curl -fLsS --max-time 30 "https://raw.githubusercontent.com/googlefonts/noto-emoji/$emoji_commit/2D/fonts/NotoColorEmoji.ttf" -o "$font_dir/NotoColorEmoji.ttf"
cd "$font_dir"
sha256sum -c <<'SUMS'
b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5  NotoSans-Regular.ttf
c976e4b1b99edc88775377fcc21692ca4bfa46b6d6ca6522bfda505b28ff9d6a  NotoSans-Bold.ttf
630846d528dbe4c4981370a4d0a9475a1fd1491a129bb411f8e157cdb5de13c6  NotoSansSymbols2-Regular.ttf
15671215ab769fdc7162a045d56fd7d7e477c51b04e6b3c761d914d8fdd6cc44  NotoColorEmoji.ttf
SUMS
fc-cache -f "$font_dir"
fc-match -f '%{family}\n' 'Noto Color Emoji' | grep -F 'Noto Color Emoji'
