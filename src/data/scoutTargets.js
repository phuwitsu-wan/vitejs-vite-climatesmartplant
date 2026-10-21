// เป้าหมายการสำรวจรายระยะ ผูกกับเงื่อนไขอากาศ
// when: เงื่อนไขทั้งหมดต้องผ่านจึงจะถือว่า "ระบุชนิดได้"
//   rhMin ความชื้นเฉลี่ย 7 วัน / rhNightMin ความชื้นกลางคืน
//   tmaxMin tmaxMax อุณหภูมิสูงสุดเฉลี่ย / tminMax อุณหภูมิต่ำสุดเฉลี่ย
//   rain7Min rain7Max ฝนสะสม 7 วัน / dryStreakMin ฝนทิ้งช่วง
//   wetHoursMin ชั่วโมงใบเปียก

export const SCOUT_TARGETS = {
  rice: [
    { key: 'bph', name: 'เพลี้ยกระโดดสีน้ำตาล', type: 'insect', stages: ['tillering', 'booting', 'flowering'],
      when: { rhMin: 75, tmaxMin: 28, tmaxMax: 35 }, prio: 3,
      ett: 'พบตัวเต็มวัยหรือตัวอ่อนเกิน 10 ตัวต่อกอ หรือ 1 ตัวต่อต้น',
      method: 'สุ่ม 10 จุด จุดละ 10 กอ แหวกกอดูโคนต้นเหนือระดับน้ำ ช่วงเช้า' },
    { key: 'blast', name: 'โรคไหม้', type: 'disease', stages: ['tillering', 'booting', 'flowering'],
      when: { rhNightMin: 85, tminMax: 26, wetHoursMin: 8 }, prio: 3,
      ett: 'พบแผลรูปตาบนใบเกิน 5% ของใบที่สุ่ม',
      method: 'สุ่ม 10 จุด ดูใบล่างถึงใบธง โดยเฉพาะแปลงที่ใส่ไนโตรเจนสูง' },
    { key: 'sheathblight', name: 'โรคกาบใบแห้ง', type: 'disease', stages: ['booting', 'flowering', 'ripening'],
      when: { rhMin: 80, tmaxMin: 30 }, prio: 2,
      ett: 'พบแผลที่กาบใบเกิน 10% ของกอที่สุ่ม',
      method: 'ตรวจกาบใบระดับผิวน้ำในแปลงที่ปลูกแน่น' },
    { key: 'stemborer', name: 'หนอนกอข้าว', type: 'insect', stages: ['tillering', 'booting'],
      when: { dryStreakMin: 5 }, prio: 2,
      ett: 'พบยอดเหี่ยวเกิน 10% หรือรวงขาวเกิน 5%',
      method: 'นับยอดเหี่ยวและรวงขาว 10 จุดต่อไร่' }
  ],
  maize: [
    { key: 'faw', name: 'หนอนกระทู้ข้าวโพดลายจุด', type: 'insect', stages: ['ve', 'v4', 'v8', 'vt'],
      when: { tmaxMin: 28 }, prio: 3,
      ett: 'พบต้นถูกทำลายเกิน 20% ในระยะ V1-V6 หรือเกิน 40% ระยะ V7-V12',
      method: 'สุ่ม 20 ต้นต่อจุด 5 จุด ดูยอดและกรวยใบ พบขุยคล้ายขี้เลื่อย' },
    { key: 'downy', name: 'โรคราน้ำค้าง', type: 'disease', stages: ['ve', 'v4'],
      when: { rhNightMin: 85, tminMax: 24 }, prio: 3,
      ett: 'พบต้นแสดงอาการใบลายทางขาวเกิน 5%',
      method: 'เดินสำรวจช่วงเช้าที่ยังมีน้ำค้าง ถอนต้นเป็นโรคเผาทำลาย' },
    { key: 'rust', name: 'โรคราสนิม', type: 'disease', stages: ['v8', 'vt', 'r1'],
      when: { rhMin: 80, tmaxMax: 32 }, prio: 2,
      ett: 'พบตุ่มสนิมบนใบเกิน 10% ของพื้นที่ใบ',
      method: 'ตรวจใบกลางต้นขึ้นไป' }
  ],
  cassava: [
    { key: 'mealybug', name: 'เพลี้ยแป้งมันสำปะหลัง', type: 'insect', stages: ['sprout', 'leaf'],
      when: { dryStreakMin: 7, tmaxMin: 32 }, prio: 3,
      ett: 'พบยอดแสดงอาการหงิกงอเกิน 10% ของต้นที่สุ่ม',
      method: 'สุ่ม 20 ต้น ดูยอดอ่อนและซอกใบ' },
    { key: 'redmite', name: 'ไรแดง', type: 'insect', stages: ['leaf', 'bulk'],
      when: { dryStreakMin: 10, rhMin: 0 }, prio: 2,
      ett: 'พบใบล่างเหลืองซีดเป็นจุดประเกิน 20%',
      method: 'พลิกดูใต้ใบล่างและใบกลาง ช่วงอากาศแล้งจัด' },
    { key: 'cmd', name: 'โรคใบด่างมันสำปะหลัง', type: 'disease', stages: ['sprout', 'leaf', 'bulk'],
      when: {}, prio: 3,
      ett: 'พบแม้ต้นเดียวต้องถอนทำลายทันที ไม่มีเกณฑ์ผ่อนผัน',
      method: 'เดินสำรวจทุก 2 สัปดาห์ ดูใบยอดด่างเหลืองหงิกงอ แจ้งเจ้าหน้าที่ทันทีที่พบ' }
  ],
  chili: [
    { key: 'thrips', name: 'เพลี้ยไฟพริก', type: 'insect', stages: ['veg', 'flower', 'fruit'],
      when: { dryStreakMin: 5, tmaxMin: 32 }, prio: 3,
      ett: 'พบเฉลี่ยเกิน 5 ตัวต่อยอด',
      method: 'เคาะยอดบนกระดาษขาว 20 จุด ช่วงสายถึงบ่าย' },
    { key: 'broadmite', name: 'ไรขาวพริก', type: 'insect', stages: ['veg', 'flower'],
      when: { rhMin: 80, tmaxMin: 28 }, prio: 3,
      ett: 'พบยอดหงิกม้วนงอเกิน 10% ของต้น',
      method: 'ดูยอดอ่อน ใบม้วนลงด้านล่าง ต่างจากเพลี้ยไฟที่ม้วนขึ้น' },
    { key: 'anthracnose', name: 'โรคแอนแทรคโนส (กุ้งแห้ง)', type: 'disease', stages: ['fruit', 'pick'],
      when: { rhMin: 85, rain7Min: 20, wetHoursMin: 8 }, prio: 3,
      ett: 'พบผลเน่าเกิน 3% ต้องจัดการทันที',
      method: 'ตรวจผลที่เริ่มเปลี่ยนสี เก็บผลเป็นโรคออกจากแปลง' }
  ],
  mungbean: [
    { key: 'thrips', name: 'เพลี้ยไฟถั่วเขียว', type: 'insect', stages: ['flower', 'pod'],
      when: { dryStreakMin: 5, tmaxMin: 32 }, prio: 3,
      ett: 'พบเกิน 5 ตัวต่อช่อดอก',
      method: 'เคาะช่อดอกบนกระดาษขาว 10 จุด' },
    { key: 'podborer', name: 'หนอนเจาะฝักถั่ว', type: 'insect', stages: ['pod', 'seed'],
      when: {}, prio: 3,
      ett: 'พบฝักถูกเจาะเกิน 10%',
      method: 'สุ่ม 20 ต้น นับฝักที่มีรูเจาะและมูลหนอน' },
    { key: 'whitefly', name: 'แมลงหวี่ขาว (พาหะโรคใบด่าง)', type: 'insect', stages: ['leaf', 'branch', 'flower'],
      when: { dryStreakMin: 4 }, prio: 2,
      ett: 'พบเกิน 3 ตัวต่อยอด หรือเริ่มพบต้นใบด่างเหลือง',
      method: 'ใช้กับดักกาวเหนียวสีเหลือง 80 กับดักต่อไร่' }
  ],
  cabbage: [
    { key: 'dbm', name: 'หนอนใยผัก', type: 'insect', stages: ['veg', 'cup', 'head'],
      when: { rain7Max: 10 }, prio: 3,
      ett: 'พบเฉลี่ยเกิน 0.3 ตัวต่อต้นระยะกล้า หรือ 1 ตัวต่อต้นระยะห่อปลี',
      method: 'สุ่ม 20 ต้น พลิกดูใต้ใบ หนอนดิ้นถอยหลังและห้อยใย ดื้อสารเคมีเร็วมาก ต้องสลับกลุ่มทุกรอบ' },
    { key: 'armyworm', name: 'หนอนกระทู้ผัก', type: 'insect', stages: ['veg', 'cup'],
      when: { tmaxMin: 30 }, prio: 2,
      ett: 'พบกลุ่มไข่หรือหนอนเกิน 1 กลุ่มต่อ 10 ต้น',
      method: 'ตรวจใต้ใบล่างช่วงเย็น เก็บกลุ่มไข่ทำลาย' },
    { key: 'softrot', name: 'โรคเน่าเละ', type: 'disease', stages: ['cup', 'head', 'mature'],
      when: { rhMin: 85, rain7Min: 25, tmaxMin: 28 }, prio: 3,
      ett: 'พบต้นเน่าเกิน 2% ต้องถอนออกทันที',
      method: 'ตรวจโคนต้นและใบล่างหลังฝน มีกลิ่นเหม็นเฉพาะตัว' }
  ],
  garlic: [
    { key: 'thrips', name: 'เพลี้ยไฟ', type: 'insect', stages: ['leaf', 'bulb'],
      when: { dryStreakMin: 5, tmaxMin: 30 }, prio: 3,
      ett: 'พบเกิน 5 ตัวต่อต้น',
      method: 'ตรวจซอกใบและยอด ใบเป็นรอยขีดสีเงิน' },
    { key: 'purpleblotch', name: 'โรคใบจุดสีม่วง', type: 'disease', stages: ['leaf', 'bulb', 'expand'],
      when: { rhNightMin: 85, wetHoursMin: 8 }, prio: 3,
      ett: 'พบแผลบนใบเกิน 10% ของใบที่สุ่ม',
      method: 'ตรวจใบล่างหลังคืนที่มีน้ำค้างจัด' }
  ],
  sugarcane: [
    { key: 'stemborer', name: 'หนอนกออ้อย', type: 'insect', stages: ['plantgerm', 'tiller', 'elongation'],
      when: { dryStreakMin: 7 }, prio: 3,
      ett: 'พบยอดเหี่ยวเกิน 10% ของกอ',
      method: 'สุ่ม 5 จุดต่อไร่ นับยอดเหี่ยวและรูเจาะที่ลำ' },
    { key: 'whitegrub', name: 'ด้วงหนวดยาว', type: 'insect', stages: ['tiller', 'elongation'],
      when: { rain7Min: 20 }, prio: 2,
      ett: 'พบตัวหนอนเกิน 1 ตัวต่อกอ',
      method: 'ขุดตรวจรอบกออ้อยที่แสดงอาการเหี่ยวเป็นหย่อม' }
  ],
  durian: [
    { key: 'phytophthora', name: 'โรครากเน่าโคนเน่า', type: 'disease', stages: ['set', 'expand', 'fill'],
      when: { rain7Min: 40, rhMin: 85 }, prio: 3,
      ett: 'พบรอยยางไหลหรือแผลฉ่ำน้ำที่โคนต้นแม้ต้นเดียว',
      method: 'ตรวจโคนต้นและคอดินหลังฝนตกหนัก ถากเปลือกดูเนื้อไม้สีน้ำตาล' },
    { key: 'seedborer', name: 'หนอนเจาะเมล็ดทุเรียน', type: 'insect', stages: ['expand', 'fill'],
      when: {}, prio: 3,
      ett: 'พบรูเจาะหรือมูลที่ผิวผลแม้ผลเดียว',
      method: 'ตรวจผลที่อายุเกิน 60 วัน เก็บผลร่วงออกจากสวนทุก 2-3 วัน' },
    { key: 'mite', name: 'ไรแดงแอฟริกัน', type: 'insect', stages: ['bloom', 'set'],
      when: { dryStreakMin: 10 }, prio: 2,
      ett: 'พบใบซีดเป็นจุดประเกิน 20% ของใบ',
      method: 'ส่องใต้ใบด้วยแว่นขยายช่วงอากาศแล้ง' }
  ],
  mangoRipe: [
    { key: 'leafhopper', name: 'เพลี้ยจักจั่นมะม่วง', type: 'insect', stages: ['bloom'],
      when: { tmaxMin: 28 }, prio: 3,
      ett: 'พบเกิน 5 ตัวต่อช่อดอก',
      method: 'เคาะช่อดอกบนกระดาษขาวช่วงเช้าตรู่ 10 ช่อต่อต้น' },
    { key: 'powdery', name: 'โรคราแป้ง', type: 'disease', stages: ['bloom', 'set'],
      when: { rhMin: 70, tmaxMax: 32, tminMax: 22 }, prio: 3,
      ett: 'พบผงแป้งขาวบนช่อดอกเกิน 5% ของช่อ',
      method: 'ตรวจช่อดอกช่วงอากาศเย็นและมีหมอก' },
    { key: 'anthracnose', name: 'โรคแอนแทรคโนส', type: 'disease', stages: ['recover', 'develop', 'mature'],
      when: { rhMin: 85, rain7Min: 20, wetHoursMin: 8 }, prio: 3,
      ett: 'พบจุดดำบนใบอ่อนหรือผลเกิน 5%',
      method: 'ตรวจใบอ่อนชุดใหม่และผิวผลที่เริ่มแก่' },
    { key: 'fruitfly', name: 'แมลงวันผลไม้', type: 'insect', stages: ['mature'],
      when: {}, prio: 3,
      ett: 'พบรอยเจาะที่ผลหรือจับได้เกิน 5 ตัวต่อกับดักต่อวัน',
      method: 'แขวนกับดักเมทิลยูจินอล เก็บผลร่วงออกจากสวนทุก 2-3 วัน' }
  ],
  mangoGreen: [
    { key: 'leafhopper', name: 'เพลี้ยจักจั่นมะม่วง', type: 'insect', stages: ['bloom'],
      when: { tmaxMin: 28 }, prio: 3,
      ett: 'พบเกิน 5 ตัวต่อช่อดอก',
      method: 'เคาะช่อดอกบนกระดาษขาวช่วงเช้าตรู่' },
    { key: 'thrips', name: 'เพลี้ยไฟ', type: 'insect', stages: ['bloom', 'set', 'greenpick'],
      when: { dryStreakMin: 5, tmaxMin: 32 }, prio: 3,
      ett: 'พบเกิน 3 ตัวต่อช่อ ผิวผลจะกร้านเสียราคา',
      method: 'เคาะช่อดอกและผลอ่อนบนกระดาษขาว' },
    { key: 'mealybug', name: 'เพลี้ยแป้ง', type: 'insect', stages: ['set', 'greenpick'],
      when: { dryStreakMin: 7 }, prio: 2,
      ett: 'พบกลุ่มเพลี้ยแป้งเกิน 10% ของผล',
      method: 'ตรวจขั้วผลและซอกผล เนื่องจากขายที่ผิวผล' }
  ],
  tamarind: [
    { key: 'powdery', name: 'โรคราแป้ง', type: 'disease', stages: ['flush', 'youngpod'],
      when: { rhMin: 70, tmaxMax: 33 }, prio: 3,
      ett: 'พบผงขาวบนช่อดอกเกิน 5%',
      method: 'ตรวจช่อดอกและใบอ่อน' },
    { key: 'podborer', name: 'หนอนเจาะฝักมะขาม', type: 'insect', stages: ['storing', 'earlyharvest', 'expand'],
      when: {}, prio: 3,
      ett: 'พบฝักมีรอยเจาะเกิน 5%',
      method: 'สุ่มตรวจฝัก 20 ฝักต่อต้น เก็บฝักเสียออกจากสวน' }
  ],
  avocado: [
    { key: 'phytophthora', name: 'โรครากเน่าไฟทอปธอรา', type: 'disease', stages: ['expand', 'oil'],
      when: { rain7Min: 40, rhMin: 85 }, prio: 3,
      ett: 'พบต้นใบเหลืองซีดใบเล็กปลายกิ่งแห้งแม้ต้นเดียว',
      method: 'ตรวจทรงพุ่มและขุดดูรากฝอยบริเวณชายพุ่ม' },
    { key: 'thrips', name: 'เพลี้ยไฟ', type: 'insect', stages: ['bloom', 'set'],
      when: { dryStreakMin: 5, tmaxMin: 32 }, prio: 3,
      ett: 'พบเกิน 5 ตัวต่อช่อ ทำให้ผิวผลกร้าน',
      method: 'เคาะช่อดอกและผลอ่อนบนกระดาษขาว' }
  ]
};

export const GENERIC_SCOUT = {
  key: 'generic',
  name: 'สำรวจโรคและแมลงตามระยะการเติบโต',
  type: 'general',
  ett: 'ยังไม่มีเงื่อนไขอากาศที่ชี้ชัดว่าศัตรูพืชชนิดใดเสี่ยงเป็นพิเศษ ให้สำรวจตามปกติและบันทึกสิ่งที่พบ',
  method: 'เดินสำรวจแบบซิกแซก 10 จุดต่อแปลง จุดละ 10 ต้น ดูยอด ใต้ใบ โคนต้น และผล บันทึกชนิดและจำนวนที่พบลงแอป'
};