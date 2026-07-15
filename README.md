# Shiv AutoFill

Apna khud ka autofill Chrome extension — kisi bhi form ko khud bhariye, "rule" ke roop mein save kariye, aur agli baar wahi page apne aap bhar jayega.

## Kaam kaise karta hai

1. Kisi bhi website ka form khud bharein (jaisa aap normally bharte hain)
2. Us form ke kisi field par ya page par kahin bhi **right-click** karein
3. **"Shiv AutoFill"** menu se chunein:
   - **"Yeh form is page ke liye save karein"** — sirf isi exact page (URL path) ke liye
   - **"Yeh form poori site ke liye save karein"** — is poore domain ke har page ke liye
4. Bas — agli baar jab bhi ye page (ya site) khulega, ye fields **apne aap** bhar jayengi

## Overwrite kaise kaam karta hai

Default: agar koi field pehle se bhari hai (site ne khud bhari ho, ya browser ke apne autofill se), to Shiv AutoFill use **chhedta nahi** — sirf khali fields bharta hai.

Agar aap chahte hain ki saved value hamesha force ho (chahe field mein kuch bhara ho), to side panel ke **Site Rules** tab mein us rule ke saamne **"Overwrite"** toggle ON kar dein.

## Side panel se manage karna

Extension icon par click karke side panel kholein:

- **Site Rules tab** — saare saved rules dikhte hain (Page/Site scope, kitni fields, Overwrite toggle, delete button)
- **Profiles tab** — agar chahen to manually bhi profile bana sakte hain aur "Fill Now" ya `Alt+Shift+F` se explicitly fill kar sakte hain (optional, rules ke bina bhi use ho sakta hai)

## Backup

- **Export** — poora data (rules + profiles) ek `.json` file mein download hoga
- **Import** — pehle se export ki hui file wapas load karein

## Install kaise karein (unpacked / developer mode)

1. Chrome mein jaayein: `chrome://extensions`
2. Top-right corner mein **Developer mode** ON karein
3. **Load unpacked** button click karein
4. Extract ki hui `shiv-autofill` folder select karein (jismein `manifest.json` seedha andar ho)

## Shortcuts customize karna

`chrome://extensions/shortcuts` par jaake shortcuts apni pasand se set kar sakte hain.

---
Shiv Computer ke liye bana — 2026
