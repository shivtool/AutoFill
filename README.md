# Shiv AutoFill

Apna khud ka autofill Chrome extension — kisi bhi form ko khud bhariye, "rule" ke roop mein save kariye, aur agli baar wahi page apne aap bhar jayega.

## Kaam kaise karta hai

1. Kisi bhi website ka form khud bharein (jaisa aap normally bharte hain)
2. Us form ke kisi field par ya page par kahin bhi **right-click** karein
3. **"Shiv AutoFill"** menu se chunein:
   - **"Yeh form is page ke liye save karein"** — sirf isi exact page (URL path) ke liye
   - **"Yeh form poori site ke liye save karein"** — is poore domain ke har page ke liye
4. Bas — agli baar jab bhi ye page (ya site) khulega, ye fields **apne aap** bhar jayengi

<<<<<<< HEAD
## Custom dropdowns (list wale)

Jo dropdown asli `<select>` nahi hote (Angular ng-select / Material, React-Select, MUI, Ant Design,
ya khud banaye `div + ul/li` wale) unhe bhi ye extension pehchanta hai. Save karte waqt unmein dikhne wala
text (jaise `MATHEMATICS(131)`) save hota hai. Agli baar extension list ko khud kholta hai, option dhundhta
hai (zaroorat par scroll ya type karke), click karta hai aur check karta hai ki value sach mein set hui.
Save ke baad page par toast mein `(N dropdown)` dikhta hai — agar 0 dikhe to wo dropdown pehchana nahi gaya.

## Multi-tab / multi-step forms

- **Save** ab chhupe hue tab / step ke bhare hue fields bhi pakadta hai (sirf unke jo aapne badle hain).
- Ek hi page par kai baar save karne se purana rule **mit-ta nahi, judta hai**: naye save wali field apni purani value badal deti hai,
  baaki purani fields bani rehti hain. Kisi ko hatana ho to rule ke ✎ se hata dein.
- Tab/step badalne (click, keyboard, ya page ke khud badalne) par nayi dikhi fields 0.5 second mein apne aap bhar jaati hain.
- Dropdown (custom) sirf tab dikhne par save/fill hota hai, isliye har tab par ek baar Save karna theek rahta hai.

## Rule edit karna (✎)

Side Panel -> Site Rules -> rule ke saamne **✎**: har field ki value badal sakte hain, field hata sakte hain (✕),
Overwrite on/off kar sakte hain, aur **＋ Field** se koi bhi field label se jod sakte hain (jaise "Student's Height").
Dropdown mein option ka text likhein (jaise `1 - Less than 1 km`). Fill ke baad page ke Console (F12) mein
`[AutoFill] bhara / nahi bhara` ki line dikhti hai: kaun si field nahi mili uske naam ke saath.

## Arts Stream -> Subject_1..5 (built-in)

"Academic Stream opted by student" mein **Arts Stream** select hote hi Subject_1..5 mein subject **code** ke hisaab se
101, 117, 129, 140, 142 apne aap select ho jaate hain (koi rule save karna zaroori nahi). Code badalne ho to `js/content.js` mein
`STREAM_PRESETS` ki `subjects` list badal dein. Jo subject pehle se chuna hua hai use ye nahi chhedta.

## Dependent dropdowns (Stream -> Subject)

Jab ek dropdown ke select karne par doosri dropdown ki list badalti ya load hoti hai (jaise 4.24.4 (A): pehle **Art**, phir **Subject**),
extension ab fields ko page ke order mein ek-ek karke bharta hai, har dropdown ke baad page ke settle hone ka intezaar karta hai,
phir nayi list dekhkar agli field bharta hai. Subject list der se aaye (kuch seconds) to bhi wo wait karta hai.
**Zaroori:** purana rule dobara save kar lein (right-click -> Save), taaki dropdown ka text bhi save ho jaye.

=======
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
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
