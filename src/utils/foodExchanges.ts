export interface FoodExchangeItem {
  id: string;
  nameAr: string;
  servingAr: string;
  tags: string[];
  notes?: string;
}

export interface MixedDishNote {
  nameAr: string;
  breakdown: string;
  servingAdvice?: string;
}

export interface ExchangeGroup {
  id: string;
  nameAr: string;
  shortName: string;
  category: 'carbs' | 'protein' | 'veg' | 'fruit' | 'dairy' | 'fat';
  carbsGrams: number;
  proteinGrams: number;
  fatsGrams: number;
  calories: number;
  icon: string;
  colorClass: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
  portionUnit: string;
  clinicalStandard: string;
  items: FoodExchangeItem[];
  egyptianExamples: string[];
  globalExamples: string[];
  examples: string[];
  tips?: string;
}

export const MIXED_DISHES_NOTES: MixedDishNote[] = [
  {
    nameAr: 'كشري مصري أصيل',
    breakdown: 'نشويات متعددة (أرز + مكرونة + عدس بجبة + حمص الشام) + دهون (بصل ورد مقرمش وزيت الصلصة ودقة الثوم والخل والكمون والشطة)',
    servingAdvice: 'الطبق الصغير يعادل 3-4 حصص نشويات + 1-2 حصة دهون + 1 حصة بروتين نباتي كامل.',
  },
  {
    nameAr: 'محشي مشكل بلدي (كوسة / كرنب / ورق عنب / باذنجان / فلفل)',
    breakdown: 'نشا (أرز الحشو المصري بالخلطة) + خضار (خضرة المحشي شبت وبقدونس وكزبرة وطماطم وبصل وورق الكرنب والعنب) ± بروتين ودهون (شوربة أو لحم مفروم)',
    servingAdvice: 'كل 4-5 أصابع محشي متوسطة تحسب كحصة نشويات + حصة خضار غير نشوي.',
  },
  {
    nameAr: 'ملوخية مصرية خضراء بالدجاج / الأرانب',
    breakdown: 'خضار ورقي غير نشوي (ملوخية طازجة مخروطة غنية بالحديد والمغنيسيوم) + بروتين قليل الدهن (صدر دجاج/أرانب) ± دهون (تقلية الثوم والكزبرة الناشفة)',
    servingAdvice: 'طبق الملوخية يعادل 1-2 حصة خضار + حصة دهون إن كانت التقلية بالسمن البلدي الطبيعي.',
  },
  {
    nameAr: 'مسقعة مصرية باللحمة المفرومة (أو لايت بالفرن)',
    breakdown: 'خضار (باذنجان رومي وفلفل أخضر وصلصة طماطم وثوم) + دهون (قلي الباذنجان أو مسحة زيت زيتون) + بروتين متوسط (لحم مفروم عصاج قليل الدهن)',
    servingAdvice: 'المسقعة اللايت المشوية بالفرن توفر دهون القلي الغزير، وتحسب كحصة خضار + حصة بروتين متوسط + حصة دهن صحي.',
  },
  {
    nameAr: 'فتة مصرية باللحم الكنداك/البتلو والخل والثوم',
    breakdown: 'نشويات (عيش بلدي محمص بالفرن + أرز مصري مفلفل) + بروتين (لحم بتلو/كنداك مسلوق) + دهون وصلصة (دقة الخل والثوم وصلصة الطماطم والسمن البلدي)',
    servingAdvice: 'الطبق المتوسط يعادل 3-4 حصص نشويات + 2-3 حصص بروتين + 2 حصة دهون.',
  },
  {
    nameAr: 'فول مدمس بالزيت الحار والليمون والكمون والعيش البلدي',
    breakdown: 'نشا وبروتين نباتي وألياف ذائبة (فول مدمس) + نشا (عيش بلدي ردة) + دهون صحية أوميجا-3 (زيت حار بذرة كتان أو طحينة)',
    servingAdvice: '4 ملاعق كبيرة فول مدمس + ¼ رغيف بلدي + ملعقة صغيرة زيت حار = 2 حصة نشويات + 1 حصة دهون صحية.',
  },
  {
    nameAr: 'طعمية (فلافل) مصرية سخنة بالسمسم والكرات',
    breakdown: 'نشا وبروتين نباتي (فول مدشوش وخضرة كرات وشبت وبقدونس وكسبرة وبصل وثوم) + دهون (قلي الزيت الغزير أو رشة زيت بالهوائية)',
    servingAdvice: '2 قرص طعمية مقلي عادي يعادل 1 حصة نشويات + 1 حصة دهون. طعمية القلاية الهوائية توفر حصة الدهون بالكامل.',
  },
  {
    nameAr: 'حواوشي بلدي بالعيش الأسمر والبهارات',
    breakdown: 'بروتين متوسط/عالي الدهن (لحم مفروم بلدي متبل ببصل وفلفل وبهارات) + نشا (رغيف عيش بلدي كامل الردة) + دهون طبيعية من اللحم',
    servingAdvice: 'نصف رغيف حواوشي يعادل 2 حصة نشويات + 2 حصة بروتين متوسط + 1.5 حصة دهون.',
  },
  {
    nameAr: 'شاورما دجاج أو لحم عربي بالخبز الصاج/الفينو',
    breakdown: 'بروتين (صدور دجاج أو لحم بقري متبل بالزبادي والخل والبهارات) + دهون (تتبيلة وزيت وطحينة/ثومية) + نشا (خبز صاج أو تورتيلا أو فينو)',
    servingAdvice: 'ساندوتش الشاورما الصغير يعادل 2 حصة نشويات + 2-3 حصص بروتين + 1-2 حصة دهن.',
  },
  {
    nameAr: 'بصارة مصرية فلاحية بالتقلية والليمون',
    breakdown: 'نشا وبروتين نباتي وألياف (فول مدشوش مطهو بالكزبرة والشبت والملوخية الجافة والنعناع) + دهون (بصل محمر مكرمل على الوجه)',
    servingAdvice: 'طبق البصارة الصغير يعادل 1.5 حصة نشويات + 1 حصة دهون.',
  },
  {
    nameAr: 'طاجن بامية باللحم الضاني أو البقري والليمون',
    breakdown: 'خضار غني بالألياف والزنك (بامية بلدية صغيرة وصلصة طماطم وثوم وقرن فلفل حار) + بروتين (لحم أحمر) ± دهون التسبيك',
    servingAdvice: 'طاجن البامية باللحمة يعادل 1-2 حصة خضار + 2-3 حصص بروتين متوسط.',
  },
  {
    nameAr: 'سمك بوري / بلطي مشوي بالردة مع ليمون وكمون ورز صيادية',
    breakdown: 'بروتين نقي عالي الجودة (سمك بحري/نيلي طازج) + دهون صحية أوميجا-3 + نشا (أرز صيادية بالبصل المكرمل)',
    servingAdvice: 'سمكة بلطي أو بوري متوسطة (180-200 جم لحم) تعادل 4-5 حصص بروتين قليل أو متوسط الدهن + 4 ملاعق أرز صيادية كحصة نشويات.',
  },
  {
    nameAr: 'طاجن تورلي خضار مشكل باللحم في الفرن',
    breakdown: 'خضار مشكل (كوسة، فاصوليا خضراء، جزر، بسلة، بصل، طماطم، باذنجان) + نشا خفيف (مكعبات بطاطس) + بروتين (مكعبات لحم بقري هبر)',
    servingAdvice: 'طبق التورلي الكبير يعادل 2 حصة خضار + 1 حصة نشويات + 2 حصة بروتين قليل الدهن.',
  },
  {
    nameAr: 'ورقة لحمة بالخضار والبهارات في الفرن',
    breakdown: 'بروتين نقي (شرائح لحم بتلو أو ستيك موزة) + خضار مشكل سوتيه متبل بالبصل والفلفل والطماطم والكوسة وجوزة الطيب والمستكة',
    servingAdvice: 'شريحة اللحم مع الخضار تعادل 3 حصص بروتين متوسط + 1.5 حصة خضار + 1 حصة دهن صحي.',
  },
  {
    nameAr: 'شكشوكة مصرية / عربية بالبيض والطماطم والفلفل',
    breakdown: 'بروتين وفيتامينات (بيض كامل بلدي) + خضار (طماطم مفرومة، بصل، فلفل أخضر وحار، بقدونس) + دهون (زيت زيتون أو مسحة زبدة)',
    servingAdvice: 'طبق الشكشوكة بـ 2 بيضة يعادل 2 حصة بروتين متوسط + 1 حصة خضار + 1 حصة دهون صحية.',
  },
  {
    nameAr: 'شوربة عدس أصفر بلدي بالشعرية والليمون والكمون',
    breakdown: 'نشا وبروتين نباتي وألياف ومضادات أكسدة (عدس أصفر + جزر + طماطم + بصل + ثوم + كمون) ± نشا خفيف (شعرية محمرة)',
    servingAdvice: 'بولا شوربة عدس متوسطة (كوب ونصف) تعادل 2 حصة نشويات + 1 حصة خضار.',
  },
  {
    nameAr: 'قلقاس مصري بالسلق والكزبرة وشوربة الدجاج/اللحم',
    breakdown: 'نشويات درنية مقاومة وبوتاسيوم (مكعبات قلقاس بلدي) + خضار ورقي (سلق أخضر وكزبرة خضراء وثوم محمر بسمنة خفيفة)',
    servingAdvice: 'كوب قلقاس مطبوخ بالسلق يعادل 2 حصة نشويات + 1 حصة خضار + 1 حصة دهن.',
  },
  {
    nameAr: 'طاجن فاصوليا بيضاء أو لوبيا بالصلصة واللحم',
    breakdown: 'بقوليات غنية بالبروتين النباتي والمغنيسيوم (فاصوليا بيضاء/لوبيا مسلوقة) + صلصة طماطم وثوم + مكعبات لحم أحمر',
    servingAdvice: 'كوب فاصوليا أو لوبيا مطبوخة باللحمة يعادل 2 حصة نشويات + 2 حصة بروتين قليل الدهن + 1 حصة خضار.',
  },
  {
    nameAr: 'كبسة / مضغوط / مجبوس دجاج أو لحم خليجي',
    breakdown: 'نشويات (أرز بسمتي حبة طويلة مطهو ببهارات الكبسة واللومي والقرفة والهيل) + بروتين (دجاج أو لحم) + مكسرات مفرومة للتزيين',
    servingAdvice: 'الطبق المتوسط يعادل 3-4 حصص نشويات + 3-4 حصص بروتين + 1-2 حصة دهون.',
  },
  {
    nameAr: 'مجدرة برغل أو أرز بالعدس والبصل المكرمل (شامية)',
    breakdown: 'نشا وبروتين نباتي كامل (عدس بني بجبة + برغل خشن أو أرز) + دهون صحية (زيت زيتون وبصل مقلي ذهبي)',
    servingAdvice: 'كوب مجدرة مطبوخة يعادل 2.5 حصة نشويات + 1 حصة دهون صحية.',
  },
  {
    nameAr: 'منسف أردني / عربي باللحم والجميد والأرز',
    breakdown: 'بروتين (لحم ضأن بلدي) + لبن جميد كركي أو زبادي مطبوخ + أرز مصري أو بسمتي + خبز شراك + مكسرات محمصة',
    servingAdvice: 'الصحن المتوسط يعادل 3-4 حصص نشويات + 3-4 حصص بروتين متوسط + 2 حصة ألبان + 2 حصة دهون.',
  },
  {
    nameAr: 'صيادية سمك وأرز بني بالبصل المكرمل',
    breakdown: 'بروتين نقي (سمك هامور/وقار/بياض/بلطي) + نشا (أرز مصري مطهو بمرقة السمك والبصل البني الداكن) + بهارات صيادية',
    servingAdvice: 'قطعة سمك مع 5 ملاعق أرز صيادية تعادل 4 حصص بروتين قليل الدهن + 1.5 حصة نشويات + 1 حصة دهن.',
  },
  {
    nameAr: 'بابا غنوج ومتبل باذنجان بالثوم والليمون والطحينة والزبادي',
    breakdown: 'خضار مشوي خفيف (باذنجان رومي مشوي على النار) + دهون صحية وكالسيوم (طحينة سمسم + زبادي قليل الدسم + ثوم وكمون وليمون)',
    servingAdvice: '3 ملاعق كبيرة بابا غنوج تعادل 1 حصة خضار + 1 حصة دهون صحية.',
  },
  {
    nameAr: 'سلطة حمص شامية بالطحينة والليمون وزيت الزيتون',
    breakdown: 'بقوليات وبروتين نباتي (حمص مسلوق ناعم) + دهون صحية (طحينة سمسم نقي + زيت زيتون بكر + عصير ليمون)',
    servingAdvice: '3-4 ملاعق كبيرة متبل حمص تعادل 1 حصة نشويات + 1.5 حصة دهون صحية.',
  },
  {
    nameAr: 'سلطة تبولة خضراء بالبرغل وزيت الزيتون والليمون',
    breakdown: 'خضار ورقي غني بمضادات الأكسدة والحديد (بقدونس مفروم ناعم ونعناع وطماطم وبصل أخضر) + نشا خفيف (برغل منقوع) + زيت زيتون',
    servingAdvice: 'صحن تبولة متوسط يعادل 2 حصة خضار + 0.5 حصة نشويات + 1 حصة دهن صحي.',
  },
  {
    nameAr: 'سلطة فتوش بالخضار ودبس الرمان والخبز المحمص',
    breakdown: 'خضار طازج مقرمش (خس، خيار، طماطم، فجل، بقلة، نعناع، بصل أخضر) + نشا (خبز أسمر محمص بالفرن) + صوص دبس رمان وسماق وزيت زيتون',
    servingAdvice: 'صحن فتوش كبير يعادل 2 حصة خضار + 1 حصة نشويات + 1 حصة دهون.',
  },
  {
    nameAr: 'شوربة لسان عصفور بالدجاج والليمون',
    breakdown: 'نشويات سريعة (مكرونة لسان عصفور محمرة بمسحة زيت) + مرقة دجاج مصفاة منزوعة الدسم + قطع دجاج صغيرة',
    servingAdvice: 'بولا شوربة لسان عصفور متوسطة تعادل 1.5 حصة نشويات + 1 حصة بروتين خفيف.',
  },
  {
    nameAr: 'كشك مصري / صعيدي بالزبادي والبصل المحمر',
    breakdown: 'نشا وبروتين نباتي وألبان (قمح مطحون أو دقيق + لبن رايب/زبادي + مرقة دجاج) + دهون (بصل محمر ذهبي)',
    servingAdvice: 'طبق الكشك الصغير يعادل 1 حصة نشويات + 1 حصة ألبان + 1 حصة دهون.',
  },
  {
    nameAr: 'حمام محشي بالفريك الصعيدي أو الأرز',
    breakdown: 'بروتين خفيف (حمام بلدي) + نشا عالي الألياف (فريك أخضر بلدي أو أرز بالخلطة) + دهون تحمير خفيفة',
    servingAdvice: 'فردة حمام محشية تعادل 2.5 حصة بروتين متوسط + 1.5 حصة نشويات + 1 حصة دهن.',
  },
  {
    nameAr: 'أرز باللبن / مهلبية / أم علي / كنافة / بسبوسة',
    breakdown: 'نشويات مكررة + ألبان + سكريات ودهون مضافة (سمن بلدي، مكسرات، قشطة، شربات سكر)',
    servingAdvice: 'أطباق حلى استثنائية تحسب كحصص نشويات وألبان وسكريات ودهون ولا تدرج كبديل يومي في الخطط العلاجية.',
  },
];

export const FOOD_EXCHANGE_GROUPS: ExchangeGroup[] = [
  {
    id: 'starches',
    nameAr: 'النشويات والحبوب والخبز والدرنات وبقوليات مصر والعالم العربي',
    shortName: 'نشويات وبقوليات',
    category: 'carbs',
    carbsGrams: 15,
    proteinGrams: 3,
    fatsGrams: 1,
    calories: 80,
    icon: '🌾',
    colorClass: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-800 dark:text-amber-200',
      border: 'border-amber-200 dark:border-amber-800/80',
      badge: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200',
    },
    portionUnit: 'حصة نشويات/بقوليات (15 جم كارب = ~80 ك.س)',
    clinicalStandard: 'المعهد القومي للتغذية (NNI) والجمعية الأمريكية للسكري (ADA/AND)',
    items: [
      // الخبز والمخبوزات
      { id: 'aish_baladi', nameAr: 'عيش بلدي مصري كامل الردة', servingAr: '¼ رغيف كبير أو ½ رغيف صغير ≈ 30 جم', tags: ['egyptian', 'bread', 'staple'] },
      { id: 'aish_shami', nameAr: 'عيش شامي / خبز عربي أبيض', servingAr: '¼ رغيف ≈ 30 جم', tags: ['egyptian', 'bread'] },
      { id: 'aish_saj', nameAr: 'خبز صاج / شراك / تورتيلا أسمر', servingAr: '⅓ رغيف صاج كبير (30 جم)', tags: ['bread', 'arab'] },
      { id: 'aish_fino', nameAr: 'عيش فينو / كيزر / باجيت', servingAr: '½ رغيفة صغيرة ≈ 30 جم', tags: ['egyptian', 'bread'] },
      { id: 'toast_brown', nameAr: 'توست أسمر كامل الحبوب / شوفان', servingAr: '1 شريحة توست ≈ 28-30 جم', tags: ['bread', 'global'] },
      { id: 'toast_white', nameAr: 'توست أبيض سادة', servingAr: '1 شريحة توست ≈ 25-28 جم', tags: ['bread'] },
      { id: 'bataw', nameAr: 'بتاو صعيدي وفلاحي (بالذرة والحلبة)', servingAr: 'قطعة متوسطة ≈ 30 جم', tags: ['egyptian', 'bread', 'rural'] },
      { id: 'aish_shamsi', nameAr: 'عيش شمسي صعيدي بالردة', servingAr: 'سدس (⅙) رغيف شمسي ≈ 30 جم', tags: ['egyptian', 'bread', 'rural'] },
      { id: 'marahrah', nameAr: 'عيش مرحرح فلاحي رقيق بالردة', servingAr: '¼ رغيف مرحرح ≈ 30 جم', tags: ['egyptian', 'bread', 'rural'] },
      { id: 'roqaq', nameAr: 'رقاق ناشف أو طري بلدي (سادة)', servingAr: '½ قرص رقاق صغير ≈ 25 جم', tags: ['egyptian', 'bread'] },
      { id: 'shaboora', nameAr: 'شابورة / بقسماط سن / بسكويت نخالة', servingAr: '2 أصابع أو قطعة متوسطة (20-25 جم)', tags: ['egyptian', 'snack'] },
      { id: 'rice_cakes', nameAr: 'كعك أرز منتفخ (Rice Cakes)', servingAr: '2 كعكة متوسطة', tags: ['snack', 'global'] },
      { id: 'popcorn', nameAr: 'فشار بالهواء الساخن بدون زيت', servingAr: '3 أكواب منتفخة', tags: ['snack', 'global'] },
      
      // الأرز والحبوب
      { id: 'egyptian_rice', nameAr: 'أرز مصري مسلوق / مفلفل خفيف', servingAr: '⅓ كوب مطبوخ (3 ملاعق كبيرة)', tags: ['egyptian', 'rice', 'staple'] },
      { id: 'basmati_rice', nameAr: 'أرز بسمتي حبة طويلة مسلوق', servingAr: '½ كوب مطبوخ', tags: ['rice', 'global'] },
      { id: 'brown_rice', nameAr: 'أرز بني كامل الحبة مسلوق', servingAr: '⅓ كوب مطبوخ', tags: ['rice', 'global'] },
      { id: 'rice_vermicelli', nameAr: 'أرز مصري بالشعرية', servingAr: '⅓ كوب مطبوخ', tags: ['egyptian', 'rice'] },
      { id: 'rice_sayadia', nameAr: 'أرز صيادية بني بالبصل المكرمل', servingAr: '⅓ كوب مطبوخ', tags: ['egyptian', 'rice'] },
      { id: 'freek', nameAr: 'فريك أخضر بلدي صعيدي مسلوق', servingAr: '⅓ كوب مطبوخ (3 ملاعق كبيرة)', tags: ['egyptian', 'grain', 'high-fiber'] },
      { id: 'burghul', nameAr: 'برغل خشن أو ناعم مسلوق', servingAr: '½ كوب مطبوخ', tags: ['grain', 'high-fiber'] },
      { id: 'balila', nameAr: 'بليلة قمح كامل مصري مسلوقة', servingAr: '½ كوب مسلوق (بدون سكر)', tags: ['egyptian', 'grain'] },
      { id: 'barley', nameAr: 'شعير بلدي مسلوق / تلبينة نبوية', servingAr: '½ كوب مطبوخ أو 3 م.ك دقيق شعير', tags: ['grain', 'egyptian'] },
      { id: 'oats', nameAr: 'شوفان مطبوخ / رقائق شوفان كاملة', servingAr: '½ كوب مطبوخ أو 3 ملاعق كبيرة جاف (30 جم)', tags: ['grain', 'global'] },
      { id: 'quinoa', nameAr: 'كينوا مسلوقة كاملة الأحماض', servingAr: '⅓ كوب مطبوخ', tags: ['grain', 'global'] },
      { id: 'pasta', nameAr: 'مكرونة مسلوقة (Al Dente)', servingAr: '⅓ كوب مطبوخ (3 ملاعق كبيرة)', tags: ['pasta', 'staple'] },
      { id: 'lesan_asfour', nameAr: 'لسان عصفور أو شعرية مسلوقة', servingAr: '⅓ كوب مطبوخ', tags: ['pasta', 'egyptian'] },
      { id: 'couscous', nameAr: 'كسكسي مغربي / بلدي سادة', servingAr: '⅓ كوب مطبوخ', tags: ['grain', 'arab'] },

      // البقوليات الشاملة في مصر والوطن العربي
      { id: 'ful_medames', nameAr: 'فول مدمس بلدي مهروس بالكمون والليمون', servingAr: '⅓-½ كوب (4 ملاعق كبيرة ممتلئة)', tags: ['egyptian', 'legume', 'staple'] },
      { id: 'ful_nabet', nameAr: 'فول نابت مسلوق / شوربة نابت بالكمون', servingAr: '½ كوب حبوب نابتة مسلوقة', tags: ['egyptian', 'legume', 'traditional'] },
      { id: 'ful_harati', nameAr: 'فول حراتي أخضر طازج (قرون/حبوب)', servingAr: '½ كوب حبوب خضراء طازجة أو مسلوقة', tags: ['egyptian', 'legume', 'seasonal'] },
      { id: 'ful_madshoush', nameAr: 'فول مدشوش مسلوق (للبصارة والطعمية)', servingAr: '⅓ كوب مسلوق', tags: ['egyptian', 'legume'] },
      { id: 'taameya_baked', nameAr: 'طعمية (فلافل) بالفرن أو القلاية الهوائية', servingAr: '2 قرص معمولين بمسحة زيت خفيفة', tags: ['egyptian', 'legume'] },
      { id: 'lentils_yellow', nameAr: 'عدس أصفر بلدي مسلوق / شوربة عدس', servingAr: '⅓-½ كوب مسلوق أو 1 كوب شوربة خفيفة', tags: ['legume', 'staple'] },
      { id: 'lentils_brown', nameAr: 'عدس بني (بجبة) مسلوق للكشري والسلطات', servingAr: '⅓ كوب مسلوق', tags: ['legume', 'high-fiber', 'staple'] },
      { id: 'lentils_red', nameAr: 'عدس أحمر تركي / شامي مسلوق', servingAr: '⅓ كوب مسلوق', tags: ['legume', 'arab'] },
      { id: 'chickpeas', nameAr: 'حمص الشام مسلوق (حلبسة / سلطة حمص)', servingAr: '⅓ كوب مسلوق (حوالي 4 ملاعق كبيرة)', tags: ['legume', 'egyptian', 'staple'] },
      { id: 'malana', nameAr: 'حمص أخضر طازج بلدي (مليانة)', servingAr: '½ كوب حبوب خضراء طازجة', tags: ['egyptian', 'legume', 'seasonal'] },
      { id: 'qadameh', nameAr: 'حمص محمص مقرمش غير مملح (قضامة شامية)', servingAr: '¼ كوب حبوب محمصة (≈ 25-30 جم)', tags: ['legume', 'arab', 'snack'] },
      { id: 'white_beans', nameAr: 'فاصوليا بيضاء جافة مسلوقة', servingAr: '⅓ كوب مسلوق', tags: ['legume', 'staple'] },
      { id: 'red_kidney_beans', nameAr: 'فاصوليا حمراء مسلوقة للسلطات', servingAr: '⅓ كوب مسلوق', tags: ['legume', 'global'] },
      { id: 'black_beans', nameAr: 'فاصوليا سوداء جافة مسلوقة', servingAr: '⅓ كوب مسلوق', tags: ['legume'] },
      { id: 'black_eyed_peas', nameAr: 'لوبيا بلدي ذات عين سوداء مسلوقة', servingAr: '⅓ كوب مسلوق', tags: ['egyptian', 'legume', 'staple'] },
      { id: 'termes', nameAr: 'ترمس بلدي مسلوق (حلو أو مر قليل الملح)', servingAr: '⅓-½ كوب مسلوق (سناك عالي البروتين والألياف)', tags: ['egyptian', 'legume', 'snack'] },
      { id: 'helba_sprouted', nameAr: 'حلبة منبتة طازجة بلدية', servingAr: '½ كوب منبت طازج (غنية بالمغذيات)', tags: ['egyptian', 'legume', 'traditional'] },
      { id: 'edamame', nameAr: 'فول صويا أخضر / إدامامي مسلوق بالقرون', servingAr: '½ كوب حبوب مسلوقة', tags: ['legume', 'global'] },
      { id: 'mung_beans', nameAr: 'ماش أخضر مسلوق (خليجي وشامي ومغاربي)', servingAr: '⅓ كوب مسلوق', tags: ['legume', 'arab'] },
      { id: 'split_peas', nameAr: 'بسلة جافة صفراء أو خضراء مطبوخة', servingAr: '⅓ كوب مسلوق', tags: ['legume'] },

      // الدرنات والنشويات الخضراء
      { id: 'potato', nameAr: 'بطاطس مسلوقة / مشوية بالفرن بقشرها', servingAr: '½ حبة متوسطة أو ½ كوب مكعبات (≈ 100 جم)', tags: ['starchy_veg', 'staple'] },
      { id: 'sweet_potato', nameAr: 'بطاطا حلوة مشوية / مسلوقة', servingAr: '½ حبة متوسطة أو ½ كوب (100 جم)', tags: ['starchy_veg', 'egyptian'] },
      { id: 'taro_root', nameAr: 'قلقاس مصري مسلوق (درنات غنية بالألياف)', servingAr: '½ كوب مكعبات مسلوقة', tags: ['starchy_veg', 'egyptian'] },
      { id: 'corn_cob', nameAr: 'كوز ذرة بلدي مشوي (أصفر أو أبيض)', servingAr: '½ كوز متوسط مشوي', tags: ['egyptian', 'starchy_veg', 'street-food'] },
      { id: 'corn_kernels', nameAr: 'ذرة سكرية صفراء مسلوقة', servingAr: '½ كوب حبوب مسلوقة', tags: ['starchy_veg'] },
      { id: 'green_peas_starchy', nameAr: 'بسلة خضراء مطبوخة', servingAr: '½ كوب مطبوخ', tags: ['starchy_veg'] },
    ],
    egyptianExamples: [
      '¼ رغيف عيش بلدي مصري كامل الردة (أو ½ رغيف صغير ≈ 30 جم)',
      '¼ رغيف شامي أو صاج أو قطعة بتاو فلاحي أو عيش مرحرح (30 جم)',
      '⅓ كوب أرز مصري مسلوق أو مفلفل خفيف (3 ملاعق كبيرة)',
      '⅓ كوب أرز بالشعرية أو أرز صيادية بني أو فريك بلدي مطبوخ',
      '⅓-½ كوب مكرونة مسلوقة أو لسان عصفور',
      '½ كوب بليلة قمح كامل مسلوقة أو شعير بلدي بدون سكر',
      '½ حبة بطاطس مسلوقة أو مشوية (100 جم) أو ½ حبة بطاطا حلوة',
      '½ كوز ذرة مشوي بلدي أصفر أو أبيض أو ½ كوب قلقاس مسلوق',
      '⅓-½ كوب فول مدمس بالكمون والليمون (4 ملاعق كبيرة)',
      '½ كوب فول نابت أو فول حراتي أخضر طازج',
      '⅓ كوب عدس أصفر/بجبة أو حمص الشام أو لوبيا أو فاصوليا بيضاء',
      '⅓-½ كوب ترمس بلدي مسلوق خفيف الملح أو حلبة منبتة',
      '2 قرص طعمية بالفرن أو القلاية الهوائية',
    ],
    globalExamples: [
      '1 Slice 100% Whole Wheat Toast (~30g)',
      '½ Cup Cooked Oatmeal (or 3 Tbsp dry rolled oats ~30g)',
      '½ Cup Cooked Basmati or Brown Rice',
      '⅓ Cup Cooked Quinoa or Whole Wheat Couscous',
      '2 Whole Grain Rice Cakes',
      '3 Cups Air-popped Popcorn (No butter)',
      '⅓ Cup Cooked Chickpeas, Black Beans, or Edamame',
      '½ Cup Boiled Sweet Potato or Steamed Green Peas',
    ],
    examples: [
      '¼ رغيف بلدي مصري كامل الردة (30 جم)',
      '1 شريحة توست أسمر حبوب كاملة',
      '⅓ كوب أرز مصري أو بسمتي أو فريك مسلوق (3 م.ك)',
      '½ كوب شوفان مطبوخ أو بليلة قمح كامل',
      '½ حبة بطاطس مسلوقة أو بطاطا حلوة مشوية (100 جم)',
      '4 ملاعق كبيرة فول مدمس بلدي بالليمون والكمون',
      '⅓ كوب حمص الشام أو عدس بجبة أو لوبيا مسلوقة',
      '⅓ كوب ترمس بلدي مسلوق خفيف الملح',
      '½ كوز ذرة مشوي بلدي',
      '3 أكواب فشار هواء بدون زيت',
    ],
    tips: 'تتميز البقوليات والحبوب الكاملة المصرية والعربية بأنها تجمع بين النشويات المعقدة والألياف الذائبة والبروتين النباتي، مما يثبت سكر الدم ويمنح شبعاً ممتازاً.',
  },
  {
    id: 'lean_protein',
    nameAr: 'البروتين قليل الدهون (Lean Protein)',
    shortName: 'بروتين خفيف',
    category: 'protein',
    carbsGrams: 0,
    proteinGrams: 7,
    fatsGrams: 3,
    calories: 55,
    icon: '🍗',
    colorClass: {
      bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
      text: 'text-peacock-indigo-deep dark:text-peacock-sage',
      border: 'border-peacock-sage dark:border-peacock-indigo-deep/80',
      badge: 'bg-peacock-pale text-peacock-ink dark:bg-peacock-ink/60 dark:text-peacock-sage',
    },
    portionUnit: 'حصة (30 جم مطبوخ = 7 جم بروتين / 0-3 جم دهن)',
    clinicalStandard: 'قوائم التغذية الإكلينيكية (ADA / NNI Lean Meat Exchange)',
    items: [
      { id: 'chicken_breast', nameAr: 'صدور دجاج مخلية بدون جلد مشوية أو مسلوقة', servingAr: '30 جم مطبوخ (حجم علبة كبريت)', tags: ['poultry', 'lean', 'staple'] },
      { id: 'turkey_breast', nameAr: 'صدور ديك رومي (حبش) مسلوقة أو مشوية', servingAr: '30 جم مطبوخ', tags: ['poultry', 'lean'] },
      { id: 'rabbit_meat', nameAr: 'لحم أرانب بلدي مسلوق أو مشوي', servingAr: '30 جم مطبوخ (بروتين فائق النقاء)', tags: ['meat', 'egyptian', 'very-lean'] },
      { id: 'tilapia', nameAr: 'سمك بلطي نيلي طازج مشوي بالردة أو بالفرن', servingAr: '30 جم مطبوخ', tags: ['egyptian', 'fish', 'staple'] },
      { id: 'bolti_fish', nameAr: 'سمك بحري خفيف (وقار / قشر بياض / لوت / موسى / مرجان / دينيس)', servingAr: '30 جم مطبوخ', tags: ['egyptian', 'fish'] },
      { id: 'white_fish_fillet', nameAr: 'فيليه سمك أبيض قليل الدهن (مشوي أو مسلوق)', servingAr: '30 جم مطبوخ', tags: ['fish', 'lean'] },
      { id: 'shrimp', nameAr: 'جمبري أو كابوريا مسلوقة أو مشوية (بدون زبدة)', servingAr: '30 جم لحم صافي (3-4 حبات متوسطة)', tags: ['seafood', 'lean'] },
      { id: 'calamari', nameAr: 'سبيط / كاليماري مشوي أو مسلوق بالليمون والكمون', servingAr: '30 جم مطبوخ', tags: ['seafood', 'lean'] },
      { id: 'tuna_water', nameAr: 'تونة معلبة في ماء أو مصفاة ومغسولة بالخل', servingAr: '30 جم (¼ علبة صغيرة)', tags: ['fish', 'lean', 'staple'] },
      { id: 'lean_beef', nameAr: 'لحم بقري/جاموسي/بتلو أحمر خالي الشحم (موزة حمراء أو فلتو)', servingAr: '30 جم مطبوخ', tags: ['meat', 'lean', 'egyptian'] },
      { id: 'liver', nameAr: 'كبدة دجاج أو كبدة بقري مشوية (غنية بالحديد)', servingAr: '30 جم مطبوخ', tags: ['meat', 'egyptian', 'rich-iron'] },
      { id: 'egg_white', nameAr: 'بياض بيض كبير مسلوق', servingAr: '2 بياض بيض كبير', tags: ['egg', 'very-lean', 'staple'] },
      { id: 'qareesh_protein', nameAr: 'جبنة قريش فلاحي طبيعية قليلة الدسم', servingAr: '45 جم (2 ملعقة كبيرة ممتلئة)', tags: ['egyptian', 'dairy_protein', 'staple'] },
      { id: 'white_cheese_lean', nameAr: 'جبنة بيضاء طبيعية خالية أو قليلة الدسم والملح', servingAr: '30 جم (شريحة صغيرة)', tags: ['egyptian', 'dairy_protein'] },
      { id: 'tofu_firm', nameAr: 'توفو صلب نباتي مشوي بالأعشاب', servingAr: '50 جم', tags: ['vegan', 'protein'] },
    ],
    egyptianExamples: [
      '45 جم جبنة قريش فلاحي طبيعية (2 ملعقة كبيرة ممتلئة)',
      '30 جم سمك بلطي مشوي بالردة بالليمون والكمون',
      '30 جم سمك قشر بياض أو وقار أو لوت أو مرجان أو دينيس مشوي',
      '30 جم صدور دجاج مخلية منزوعة الجلد مشوية أو مسلوقة',
      '30 جم لحم أرانب بلدي مسلوق أو مشوي',
      '30 جم تونة قطع خفيفة مصفاة ومغسولة بالخل والليمون',
      '30 جم صدور ديك رومي فصوص مسلوقة أو مشوية',
      '30 جم جمبري أو سبيط مسلوق أو مشوي بدون دهون',
      '30 جم لحم بتلو أحمر خالي الشحم تماماً',
      '30 جم كبدة مشوية خفيفة بمسحة زيت (باعتدال)',
      '2 بياض بيض كبير مسلوق',
    ],
    globalExamples: [
      '30g Skinless Grilled Chicken Breast',
      '30g Roasted Turkey Breast Slices',
      '30g White Fish Fillet (Cod, Tilapia, Seabass, Sole)',
      '30g Water-packed Canned Light Tuna (Drained)',
      '30g Boiled Shrimps / Prawns / Calamari',
      '45g Low-fat Cottage Cheese',
      '2 Large Egg Whites',
      '30g Lean Veal / Eye of Round Steak (Trimmed)',
    ],
    examples: [
      '45 جم جبن قريش فلاحي مصري (2 ملعقة كبيرة)',
      '30 جم صدور دجاج مشوية/مسلوقة بدون جلد',
      '30 جم سمك بلطي أو قشر بياض مشوي بالردة',
      '30 جم تونة لايت مصفاة من الزيت',
      '30 جم صدور رومي مشوية',
      '30 جم جمبري مسلوق أو مشوي',
      '30 جم لحم أرانب أو بتلو أحمر',
      '2 بياض بيض مسلوق',
      '30 جم كبدة مشوية خفيفة',
    ],
    tips: 'البروتين الخفيف ممتاز لبناء الألياف العضلية ورفع الحرق الأيضي وتقليل الدهون الكبدية والحشوية.',
  },
  {
    id: 'med_protein',
    nameAr: 'البروتين متوسط الدهون (Medium-Fat Protein)',
    shortName: 'بروتين متوسط',
    category: 'protein',
    carbsGrams: 0,
    proteinGrams: 7,
    fatsGrams: 5,
    calories: 75,
    icon: '🥩',
    colorClass: {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-800 dark:text-rose-200',
      border: 'border-rose-200 dark:border-rose-800/80',
      badge: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200',
    },
    portionUnit: 'حصة (30 جم مطبوخ = 7 جم بروتين + 5 جم دهن = ~75 ك.س)',
    clinicalStandard: 'قوائم التغذية الإكلينيكية (ADA / NNI Medium-Fat Protein)',
    items: [
      { id: 'whole_egg', nameAr: 'بيض كامل مسلوق أو أومليت خفيف', servingAr: '1 بيضة كاملة كبيرة (غنية بالكولين)', tags: ['egg', 'staple', 'rich-choline'] },
      { id: 'chicken_thigh', nameAr: 'أوراك دجاج بدون جلد أو دجاج مسلوق بالجلد خفيف', servingAr: '30 جم مطبوخ', tags: ['poultry'] },
      { id: 'beef_regular', nameAr: 'لحم كنداك أحمر مسلوق أو مشوي (موزة / فلتو)', servingAr: '30 جم مطبوخ', tags: ['meat', 'staple', 'egyptian'] },
      { id: 'minced_meat', nameAr: 'لحم مفروم متوسط الدهن عصاج أو كفتة حاتي بيتي', servingAr: '30 جم مطبوخ', tags: ['meat', 'egyptian'] },
      { id: 'lamb', nameAr: 'لحم ضأن / خروف متوسط الدهن مسلوق أو مشوي', servingAr: '30 جم مطبوخ', tags: ['meat', 'fatty'] },
      { id: 'pigeon_meat', nameAr: 'لحم حمام بلدي مشوي أو مسلوق', servingAr: '30 جم مطبوخ', tags: ['poultry', 'egyptian'] },
      { id: 'duck_meat', nameAr: 'لحم بط بلدي منزوع الجلد ومسلوق/مشوي', servingAr: '30 جم مطبوخ', tags: ['poultry', 'egyptian'] },
      { id: 'oily_fish', nameAr: 'سمك بوري / سلمون / ماكريل / سردين بلدي مشوي بالردة والليمون', servingAr: '30 جم مطبوخ (غني بأوميجا-3)', tags: ['fish', 'omega3', 'egyptian'] },
      { id: 'liver_alex', nameAr: 'كبدة إسكندراني بثوم وفلفل بمسحة زيت خفيفة', servingAr: '30 جم مطبوخ', tags: ['meat', 'egyptian'] },
      { id: 'basturma', nameAr: 'بسطرمة بلدي منزوعة الشحم والملح الزائد', servingAr: 'شريحة رفيعة ≈ 25-30 جم', tags: ['egyptian', 'processed', 'high-sodium'] },
      { id: 'feta_cheese', nameAr: 'جبنة فيتا قليلة الدسم والملح أو جبن دمياطي لايت', servingAr: '≈ 30 جم (شريحة بحجم علبة كبريت)', tags: ['dairy', 'cheese', 'egyptian'] },
      { id: 'mozzarella_light', nameAr: 'جبنة موزاريلا لايت / حلوم خفيف', servingAr: '≈ 30 جم مبشور أو شريحة', tags: ['dairy', 'cheese'] },
      { id: 'rumi_cheese', nameAr: 'جبنة رومي / تركي كاملة الدسم (باعتدال للصوديوم والدهن)', servingAr: '≈ 20-30 جم', tags: ['egyptian', 'cheese', 'high-fat'] },
      { id: 'halloumi', nameAr: 'جبنة حلوم مشوية أو قليلة الملح', servingAr: '30 جم شريحة', tags: ['dairy', 'cheese', 'arab'] },
      { id: 'shakshouka_egg', nameAr: 'شكشوكة بيض بالخضار والطماطم', servingAr: 'بيض كاملة مع خضار', tags: ['egg', 'egyptian'] },
    ],
    egyptianExamples: [
      '1 حبة بيض كاملة مسلوقة أو أومليت بنقطة زيت',
      '30 جم لحم كنداك أحمر مسلوق أو مشوي',
      '30 جم كفتة حاتي مشوية بيتي بمفروم قليل الدهن',
      '30 جم سمك بوري أو سلمون أو ماكريل أو سردين بلدي مشوي بالردة',
      '30 جم كبدة إسكندراني بالثوم والفلفل بمسحة زيت خفيفة',
      '30 جم جبنة فيتا لايت أو جبن دمياطي قليل الملح',
      '30 جم أوراك دجاج منزوعة الجلد مشوية',
      'شريحة بسطرمة رفيعة (30 جم) منزوعة الملح الزائد',
      '20-30 جم جبنة رومي بلدي (باعتدال)',
    ],
    globalExamples: [
      '1 Whole Large Egg (Boiled or Poached)',
      '30g Lean Beef Tenderloin / Sirloin Steak',
      '30g Grilled Salmon / Mackerel Fillet (Rich in Omega-3)',
      '30g Low-fat Feta Cheese or Halloumi Light',
      '30g Part-skim Mozzarella Cheese',
      '30g Beef Liver (Grilled with Garlic & Herbs)',
      '30g Skinless Chicken Thigh (Cooked)',
    ],
    examples: [
      '1 حبة بيض كاملة مسلوقة',
      '30 جم لحم بقري أحمر مسلوق أو مشوي',
      '30 جم سمك بوري أو سلمون أو ماكريل مشوي',
      '30 جم كفتة لحم مشوية قليلة الدهن',
      '30 جم جبنة فيتا لايت أو موزاريلا',
      '30 جم كبدة إسكندراني مشوية',
      '30 جم أوراك دجاج بدون جلد',
    ],
    tips: 'تحتوي على أحماض أوميجا-3 الأساسية والكولين للذاكرة والأعصاب والهرمونات مع دهون صحية غير مشبعة.',
  },
  {
    id: 'vegetables',
    nameAr: 'خضروات مصر والوطن العربي (ورقية وثمرية وجذرية وصليبية)',
    shortName: 'خضار وسلطات',
    category: 'veg',
    carbsGrams: 5,
    proteinGrams: 2,
    fatsGrams: 0,
    calories: 25,
    icon: '🥬',
    colorClass: {
      bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
      text: 'text-peacock-indigo-deep dark:text-peacock-sage',
      border: 'border-peacock-sage dark:border-peacock-indigo-deep/80',
      badge: 'bg-peacock-pale text-peacock-ink dark:bg-peacock-ink/60 dark:text-peacock-sage',
    },
    portionUnit: 'حصة (1 كوب طازج نيء أو ½ كوب مطبوخ = 25 ك.س)',
    clinicalStandard: 'قوائم الخضار غير النشوي (ADA / NNI Non-starchy Veg)',
    items: [
      // الخضروات الورقية والأعشاب الفلاحية والشامية
      { id: 'molokhia', nameAr: 'ملوخية مصرية خضراء مطبوخة خفيفة', servingAr: '½ كوب مطبوخ (أو طبق ملوخية صغير)', tags: ['egyptian', 'staple', 'low-carb'] },
      { id: 'molokhia_dry', nameAr: 'ملوخية ناشفة صعيدية مطبوخة', servingAr: '½ كوب مطبوخ', tags: ['egyptian', 'traditional'] },
      { id: 'gargeer', nameAr: 'جرجير بلدي فلاحي طازج', servingAr: '1-2 كوب أوراق طازجة (حر السعرات)', tags: ['egyptian', 'greens', 'free'] },
      { id: 'regla', nameAr: 'رجلة خضراء فلاحية (بقلة غنية بأوميجا-3)', servingAr: '1 كوب طازج أو ½ كوب مطبوخ', tags: ['egyptian', 'rural', 'omega3'] },
      { id: 'khobeza', nameAr: 'خبيزة مصرية فلاحية مطبوخة بالسلق', servingAr: '½ كوب مطبوخ', tags: ['egyptian', 'rural'] },
      { id: 'salq', nameAr: 'سلق بلدي فلاحي أخضر (للقلقاس والشوربة)', servingAr: '½ كوب مطبوخ أو 1 كوب طازج', tags: ['egyptian', 'greens'] },
      { id: 'spinach', nameAr: 'سبانخ بلدية طازجة أو مطبوخة بالصلصة', servingAr: '½ كوب مطبوخ أو 1 كوب طازج', tags: ['greens', 'rich-iron', 'staple'] },
      { id: 'hindbeh', nameAr: 'هندباء برية / علت فلاحي (Hindbeh)', servingAr: '1 كوب طازج أو ½ كوب مطبوخ بالثوم والزيت', tags: ['greens', 'arab', 'detox'] },
      { id: 'baqleh', nameAr: 'بقلة / بربير / رشاد طازج', servingAr: '1 كوب أوراق طازجة', tags: ['greens', 'arab', 'free'] },
      { id: 'korrat', nameAr: 'كرات بلدي مصري (للطعمية والسلطات)', servingAr: '½ كوب مفروم', tags: ['egyptian', 'allium'] },
      { id: 'leek', nameAr: 'كرات أفرنجي (Leek) مطبوخ أو بالشوربة', servingAr: '½ كوب مطبوخ', tags: ['allium', 'global'] },
      { id: 'green_onion', nameAr: 'بصل أخضر بلدي طازج', servingAr: '½ كوب مفروم أو 2-3 عيدان', tags: ['egyptian', 'allium', 'free'] },
      { id: 'red_onion', nameAr: 'بصل أحمر / صعيدي / أبيض', servingAr: '½ كوب مفروم أو 1 حبة متوسطة', tags: ['egyptian', 'allium', 'staple'] },
      { id: 'garlic', nameAr: 'ثوم بلدي / ثوم ذكر مفروم أو طازج', servingAr: '1-2 فصوص (حر النكهة)', tags: ['egyptian', 'allium'] },
      { id: 'herbs_mahshi', nameAr: 'بقدونس / شبت / كزبرة خضراء بلدية', servingAr: '1 كوب مفروم طازج (خضرة المحشي والسلطة)', tags: ['egyptian', 'herbs', 'free'] },
      { id: 'mint_fresh', nameAr: 'نعناع بلدي طازج أو مجفف', servingAr: 'أوراق طازجة حسب الرغبة', tags: ['egyptian', 'herbs', 'free'] },
      { id: 'basil_fresh', nameAr: 'ريحان وحبق بلدي وشامي طازج', servingAr: 'أوراق طازجة حسب الرغبة', tags: ['herbs', 'arab', 'free'] },
      { id: 'thyme_wild', nameAr: 'زعتر أخضر بلدي وجبلي طازج', servingAr: 'أوراق طازجة أو مجففة', tags: ['herbs', 'arab'] },
      { id: 'fennel_greens', nameAr: 'شومر أخضر وشبت رومي', servingAr: '1 كوب طازج', tags: ['herbs', 'arab'] },
      { id: 'lettuce_baladi', nameAr: 'خس بلدي مصري طويل طازج', servingAr: '1-2 كوب أوراق طازجة', tags: ['egyptian', 'greens', 'free'] },
      { id: 'lettuce_iceberg', nameAr: 'خس كابوتشا / آيسبيرج مقرمش', servingAr: '1-2 كوب مفروم', tags: ['greens', 'free'] },
      { id: 'lettuce_red', nameAr: 'خس أحمر / لولو روسو / أوك ليف', servingAr: '1-2 كوب طازج', tags: ['greens', 'free'] },
      { id: 'celery', nameAr: 'كرفس بلدي وأفرنجي طازج أو بالشوربة', servingAr: '1 كوب شرائح', tags: ['greens', 'free'] },
      { id: 'grape_leaves', nameAr: 'ورق عنب مسلوق (الورق سادة بدون أرز)', servingAr: '½ كوب مسلوق (أو 6-8 ورقات)', tags: ['egyptian', 'greens'] },

      // الخضروات الثمرية والصليبية والجذرية
      { id: 'okra_baladi', nameAr: 'بامية مصرية صعيدية / فركاوي مطبوخة بالليمون', servingAr: '½ كوب مطبوخ ني في ني', tags: ['egyptian', 'staple', 'high-fiber'] },
      { id: 'zucchini', nameAr: 'كوسة بلدية مطبوخة ني في ني أو مشوية', servingAr: '½ كوب مطبوخ (أو 1 حبة متوسطة)', tags: ['egyptian', 'staple', 'low-calorie'] },
      { id: 'eggplant_romi', nameAr: 'باذنجان رومي كبير مشوي بالفرن (بابا غنوج)', servingAr: '½ كوب مطبوخ / مشوي', tags: ['egyptian', 'staple'] },
      { id: 'eggplant_aroos', nameAr: 'باذنجان عروس أسود وأبيض مسلوق ومخلل خفيف', servingAr: '2 حبة متوسطة مسلوقة', tags: ['egyptian', 'staple'] },
      { id: 'eggplant_striped', nameAr: 'باذنجان مخدد بنفسجي للحشو والطبخ', servingAr: '½ كوب مطبوخ', tags: ['egyptian'] },
      { id: 'bell_pepper', nameAr: 'فلفل رومي أخضر وألوان (أصفر، أحمر)', servingAr: '1 كوب شرائح (فيتامين C عالي جداً)', tags: ['staple', 'rich-vitC'] },
      { id: 'hot_pepper', nameAr: 'فلفل حار بلدي / قرون شطة خضراء وحمراء', servingAr: '1-2 قرن طازج', tags: ['egyptian', 'spicy'] },
      { id: 'tomato', nameAr: 'طماطم بلدي طازجة أو صلصة بيتي خفيفة', servingAr: '1 كوب طازج مكعبات أو ½ كوب مطبوخ', tags: ['staple'] },
      { id: 'cherry_tomatoes', nameAr: 'طماطم شيري كرزية طازجة', servingAr: '1 كوب حبات كاملة', tags: ['staple'] },
      { id: 'cucumber', nameAr: 'خيار بلدي طازج بقشره', servingAr: '1-2 كوب شرائح (1-2 حبة متوسطة)', tags: ['staple', 'free'] },
      { id: 'faqqous', nameAr: 'قثاء / فاقوس / عجور بلدي طازج', servingAr: '1-2 كوب شرائح مقرمشة', tags: ['egyptian', 'summer', 'free'] },
      { id: 'cauliflower', nameAr: 'قرنبيط بلدي مسلوق أو مشوي بالفرن', servingAr: '½ كوب مطبوخ أو 1 كوب زهرات', tags: ['cruciferous', 'staple'] },
      { id: 'cabbage_baladi', nameAr: 'كرنب بلدي مسلوق أو سلطة كرنب', servingAr: '½ كوب مطبوخ أو 1 كوب طازج', tags: ['egyptian', 'cruciferous'] },
      { id: 'red_cabbage', nameAr: 'كرنب أحمر للسلطة', servingAr: '1 كوب مفروم', tags: ['cruciferous', 'antioxidants'] },
      { id: 'brussels_sprouts', nameAr: 'كرنب بروكسل مسلوق أو سوتيه', servingAr: '½ كوب مطبوخ', tags: ['cruciferous', 'global'] },
      { id: 'broccoli', nameAr: 'بروكلي أخضر مسلوق على البخار أو سوتيه', servingAr: '½ كوب مطبوخ أو 1 كوب زهرات', tags: ['cruciferous', 'global'] },
      { id: 'turnip', nameAr: 'لفت بلدي طازج أو مخلل خفيف', servingAr: '½ كوب شرائح', tags: ['egyptian'] },
      { id: 'radish_red', nameAr: 'فجل بلدي أحمر طازج', servingAr: '1 كوب شرائح', tags: ['egyptian', 'free'] },
      { id: 'radish_white', nameAr: 'فجل بلدي أبيض بالعرش الأخضر', servingAr: '1 كوب شرائح وأوراق', tags: ['egyptian', 'free'] },
      { id: 'beetroot', nameAr: 'شمندر (بنجر) بلدي أحمر مسلوق', servingAr: '½ كوب شرائح مسلوقة', tags: ['egyptian', 'antioxidants'] },
      { id: 'carrot', nameAr: 'جزر أصفر أو برتقالي طازج أو مسلوق', servingAr: '½ كوب مطبوخ أو 1 حبة متوسطة', tags: ['rich-vitA', 'staple'] },
      { id: 'artichoke', nameAr: 'خرشوف بلدي طازج مسلوق أو بالفرن', servingAr: '½ كوب مسلوق (قلب 1-2 خرشوفة)', tags: ['egyptian', 'liver-health'] },
      { id: 'green_beans_veg', nameAr: 'فاصوليا خضراء بلدية مطبوخة / سوتيه', servingAr: '½ كوب مطبوخ', tags: ['staple'] },
      { id: 'cowpea_pods', nameAr: 'لوبيا خضراء قرون طازجة مطبوخة', servingAr: '½ كوب مطبوخ', tags: ['egyptian', 'greens'] },
      { id: 'mushrooms', nameAr: 'فطر (مشروم) عيش غراب بلدي ومحاري طازج', servingAr: '½ كوب مطبوخ أو 1 كوب شرائح طازجة', tags: ['global', 'high-protein-veg'] },
      { id: 'pumpkin_veg', nameAr: 'قرع عسلي / يقطين بلدي مسلوق أو مشوي', servingAr: '½ كوب مطبوخ سادة', tags: ['low-calorie'] },
      { id: 'summer_squash', nameAr: 'قرع أخضر صيفي / كوسة صفراء', servingAr: '½ كوب مطبوخ', tags: ['low-calorie'] },
      { id: 'asparagus', nameAr: 'هليون / أسبارجوس مسلوق أو مشوي', servingAr: '½ كوب مطبوخ أو 6-8 أعواد', tags: ['global', 'rich-fiber'] },
      { id: 'akkoub', nameAr: 'عكوب جبلي شامي مطهو خفيف', servingAr: '½ كوب مطبوخ', tags: ['arab', 'wild'] },
      { id: 'pickles_light', nameAr: 'مخللات بلدية خفيفة الملح (خيار/لفت/ليمون معصفر)', servingAr: 'كمية صغيرة مع مراعاة ضغط الدم', tags: ['egyptian', 'high-sodium'] },
    ],
    egyptianExamples: [
      '1 طبق كبير سلطة خضراء بلدي طازجة (خيار، طماطم، جرجير، خس، فلفل رومي، بقدونس، بصل أخضر)',
      '½ كوب ملوخية مصرية خضراء خفيفة طازجة أو ناشفة',
      '½ كوب كوسة أو بامية مطبوخة ني في ني بالليمون والثوم',
      '½ كوب باذنجان رومي مشوي بالفرن (بابا غنوج دايت بالليمون والكمون)',
      '½ كوب سبانخ أو فاصوليا خضراء مطبوخة بالصلصة الخفيفة',
      '½ كوب قرنبيط أو كرنب مسلوق أو مشوي بالفرن',
      '1-2 كوب جرجير وخس بلدي وخيار وفاقوس طازج',
      '½ كوب خرشوف بلدي مسلوق أو شوربة خضار مشكلة دايت',
      '½ كوب خبيزة أو رجلة فلاحي طازجة ومطبوخة',
      '½ كوب بنجر (شمندر) مسلوق أو جزر طازج',
    ],
    globalExamples: [
      '1 Cup Raw Mixed Salad Greens (Spinach, Arugula, Romaine, Cucumbers)',
      '½ Cup Steamed Broccoli or Cauliflower Florets',
      '½ Cup Cooked Green Beans / Zucchini / Asparagus',
      '1 Cup Fresh Sliced White or Portobello Mushrooms',
      '1 Cup Chopped Mixed Bell Peppers (Red, Yellow, Green)',
      '½ Cup Steamed Spinach / Swiss Chard / Kale',
    ],
    examples: [
      '1 طبق سلطة خضراء بلدي مشكلة طازجة',
      '½ كوب ملوخية مصرية خضراء',
      '½ كوب كوسة أو بامية مطبوخة ني في ني',
      '½ كوب باذنجان مشوي بالثوم والليمون',
      '½ كوب فاصوليا خضراء أو سبانخ مطبوخة',
      '1 كوب بروكلي أو قرنبيط مسلوق',
      '1-2 كوب خيار وجرجير وخس طازج',
      '½ كوب خرشوف مسلوق أو سوتيه مشكل',
    ],
    tips: 'الخضروات الورقية والملوخية والجرجير والرجلة غنية بمضادات الأكسدة والبوتاسيوم والإنزيمات الهاضمة، وتدعم الكبد والقولون والشبع بدون أي سعرات تذكر.',
  },
  {
    id: 'fruits',
    nameAr: 'فواكه مصر والعالم العربي (طازجة ومجففة وتمور وموالح)',
    shortName: 'فواكه وتمور',
    category: 'fruit',
    carbsGrams: 15,
    proteinGrams: 0,
    fatsGrams: 0,
    calories: 60,
    icon: '🍎',
    colorClass: {
      bg: 'bg-orange-50 dark:bg-orange-950/40',
      text: 'text-orange-800 dark:text-orange-200',
      border: 'border-orange-200 dark:border-orange-800/80',
      badge: 'bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200',
    },
    portionUnit: 'حصة فاكهة (15 جم كارب فواكه طبيعي = 60 ك.س)',
    clinicalStandard: 'قوائم الفواكه المعتمدة (ADA / Egyptian NNI Fruit Exchange)',
    items: [
      // الموالح والحمضيات المصرية والعربية
      { id: 'orange_baladi', nameAr: 'برتقال بلدي صيفي / شتوي عصير أو فصوص', servingAr: '1 حبة متوسطة (≈ 150 جم)', tags: ['egyptian', 'citrus', 'rich-vitC', 'staple'] },
      { id: 'orange_navel', nameAr: 'برتقال بسرة (أبو صرة)', servingAr: '1 حبة متوسطة (≈ 150 جم)', tags: ['egyptian', 'citrus', 'staple'] },
      { id: 'orange_sugar', nameAr: 'برتقال سكري حلو', servingAr: '1 حبة متوسطة', tags: ['egyptian', 'citrus'] },
      { id: 'orange_blood', nameAr: 'برتقال أبو دمه / دم الزغلول (Blood Orange)', servingAr: '1 حبة متوسطة', tags: ['egyptian', 'citrus', 'antioxidants'] },
      { id: 'mandarin', nameAr: 'يوسفي بلدي (أفيندي / مندرين / كلمنتينا)', servingAr: '1-2 حبة حسب الحجم (≈ 150 جم)', tags: ['egyptian', 'citrus', 'rich-vitC'] },
      { id: 'lemon_baladi', nameAr: 'ليمون بلدي بنزهير / أضاليا', servingAr: 'عصير 2-3 ليمونات (حر السعرات تقريباً)', tags: ['egyptian', 'citrus', 'free'] },
      { id: 'grapefruit', nameAr: 'جريب فروت أبيض أو وردي', servingAr: '½ حبة كبيرة (≈ 150 جم)', tags: ['citrus', 'low-glycemic'] },

      // المانجو والتمور والفواكه الأصيلة المصرية والعربية
      { id: 'mango_ismailia', nameAr: 'مانجو إسماعيلاوي (فص / عويس / زبدية / سكري / نعومي / كيت)', servingAr: '½ حبة متوسطة أو ½ كوب شرائح (≈ 100 جم)', tags: ['egyptian', 'sweet', 'staple'] },
      { id: 'guava', nameAr: 'جوافة بلدية بيضاء أو بناتي حمراء', servingAr: '1 حبة متوسطة (غنية جداً بفيتامين C والألياف)', tags: ['egyptian', 'rich-vitC', 'staple'] },
      { id: 'pomegranate', nameAr: 'رمان منفلوطي وصعيدي وأسيوطي أحمر', servingAr: '½ حبة متوسطة أو ½ كوب فصوص بذور', tags: ['egyptian', 'antioxidants', 'staple'] },
      { id: 'fig_fresh', nameAr: 'تين برشومي فلاحي طازج أو تين أسود', servingAr: '2 حبة متوسطة', tags: ['egyptian', 'summer', 'staple'] },
      { id: 'cactus_fruit', nameAr: 'تين شوكي بلدي مصري طازج', servingAr: '1-2 حبة مقشرة (ألياف ممتازة)', tags: ['egyptian', 'summer', 'high-fiber'] },
      { id: 'dates_wet_omahat', nameAr: 'بلح رطب أسود (أمهات فلاحي)', servingAr: '3 حبات رطب (≈ 25 جم)', tags: ['egyptian', 'dates', 'seasonal'] },
      { id: 'dates_zaghloul', nameAr: 'بلح زغلول أحمر بلدي مقرمش', servingAr: '3 حبات بلح زغلول', tags: ['egyptian', 'dates', 'seasonal'] },
      { id: 'dates_samani', nameAr: 'بلح سماني أصفر بلدي', servingAr: '2-3 حبات بلح سماني', tags: ['egyptian', 'dates', 'seasonal'] },
      { id: 'dates_siwi', nameAr: 'تمر سيوي وصعيدي ومجدول نصف جاف', servingAr: '2-3 حبات تمر متوسطة', tags: ['egyptian', 'dates', 'staple'] },
      { id: 'dates_khalas_barhi', nameAr: 'تمور عربية (خلاص / برحي / سكري / عجوة المدينة / دجلة نور)', servingAr: '2-3 حبات تمر (≈ 20-25 جم)', tags: ['arab', 'dates', 'staple'] },

      // الفواكه الصيفية والمنعشة
      { id: 'watermelon', nameAr: 'بطيخ أحمر صيفي بلدي (جيزاوي/صحراوي)', servingAr: '1 إلى 1¼ كوب مكعبات (أو شريحة متوسطة ≈ 200 جم بالقشر)', tags: ['egyptian', 'summer', 'hydrating'] },
      { id: 'watermelon_yellow', nameAr: 'بطيخ أصفر طازج', servingAr: '1¼ كوب مكعبات', tags: ['summer', 'hydrating'] },
      { id: 'cantaloupe_egyptian', nameAr: 'شمام / قاوون بلدي إسماعيلاوي', servingAr: '1 كوب مكعبات', tags: ['egyptian', 'summer', 'hydrating'] },
      { id: 'cantaloupe', nameAr: 'كانتالوب عريشي وإسماعيلاوي طازج', servingAr: '1 كوب مكعبات (≈ 150 جم)', tags: ['summer', 'hydrating'] },
      { id: 'grapes_banati', nameAr: 'عنب بناتي أبيض أو أحمر أو فيومي', servingAr: '12-15 حبة عنب', tags: ['egyptian', 'grapes', 'staple'] },
      { id: 'grapes_black', nameAr: 'عنب أسود حلواني / كرمسون غني بالريسفيراترول', servingAr: '12-15 حبة عنب', tags: ['grapes', 'antioxidants'] },
      { id: 'peach_baladi', nameAr: 'خوخ بلدي سيناوي / سكري / كعب الغزال', servingAr: '1 حبة متوسطة (≈ 120 جم)', tags: ['egyptian', 'summer'] },
      { id: 'apricot_baladi', nameAr: 'مشمش بلدي فيومي وحموي وعماري', servingAr: '3-4 حبات مشمش', tags: ['egyptian', 'summer'] },
      { id: 'plum_baladi', nameAr: 'برقوق بلدي أحمر أو أسود أو أصفر', servingAr: '2 حبة متوسطة', tags: ['egyptian', 'summer'] },
      { id: 'nectarine', nameAr: 'نكتارين طازج خالي الوبرة', servingAr: '1 حبة متوسطة', tags: ['summer'] },
      { id: 'cherries', nameAr: 'كرز بلدي وشامي طازج', servingAr: '12-15 حبة كرز', tags: ['arab', 'summer'] },

      // التفاحيات والفواكه المتنوعة والمحلية
      { id: 'apple_baladi', nameAr: 'تفاح بلدي مصري أو أحمر/أصفر/أخضر', servingAr: '1 حبة صغيرة إلى متوسطة (≈ 120 جم)', tags: ['staple', 'high-fiber'] },
      { id: 'pear_baladi', nameAr: 'كمثرى بلدية خشنة أو سكرية أو إيطالية', servingAr: '1 حبة صغيرة إلى متوسطة', tags: ['egyptian', 'staple', 'high-fiber'] },
      { id: 'quince', nameAr: 'سفرجل بلدي وشامي', servingAr: '½ حبة متوسطة مطبوخة خفيفة', tags: ['arab', 'traditional'] },
      { id: 'banana', nameAr: 'موز بلدي مصري أو صومالي', servingAr: '½ حبة كبيرة أو 1 حبة صغيرة (≈ 90 جم)', tags: ['staple', 'rich-potassium'] },
      { id: 'strawberry', nameAr: 'فراولة بلدية إسماعيلية وبحيرة طازجة', servingAr: '1¼ كوب فراولة كاملة (≈ 8-10 حبات)', tags: ['low-glycemic', 'rich-vitC', 'staple'] },
      { id: 'mulberry_baladi', nameAr: 'توت بلدي أسود وأبيض وتوت شامي', servingAr: '¾ كوب توت طازج', tags: ['egyptian', 'berries', 'seasonal'] },
      { id: 'harankash', nameAr: 'حرنكش مصري طازج (Physalis - فاكهة الذهب)', servingAr: '¾-1 كوب حبات مقشرة (مضادات أكسدة خارقة)', tags: ['egyptian', 'antioxidants', 'superfood'] },
      { id: 'nabq_sidr', nameAr: 'نبق / سدر بلدي طازج', servingAr: '¾ كوب حبات نبق', tags: ['egyptian', 'arab', 'traditional'] },
      { id: 'doum', nameAr: 'دوم أسواني مسلوق / منقوع دوم سادة بدون سكر', servingAr: '1 كوب عصير دوم طبيعي سادة', tags: ['egyptian', 'traditional'] },
      { id: 'carob_pods', nameAr: 'خروب قرون جافة / مشروب خروب سادة', servingAr: '1 قرن متوسط أو 1 كوب منقوع سادة', tags: ['egyptian', 'traditional'] },
      { id: 'custard_apple', nameAr: 'قشطة بلدية / هندي / أنونا طازجة', servingAr: '½ حبة صغيرة إلى متوسطة (≈ 80 جم)', tags: ['egyptian', 'tropical'] },
      { id: 'papaya', nameAr: 'باباظ بلدي طازج مقطع مكعبات', servingAr: '1 كوب مكعبات (إنزيمات هاضمة)', tags: ['digestive-enzymes'] },
      { id: 'kiwi', nameAr: 'كيوي طازج غني بفيتامين C', servingAr: '1 حبة كبيرة أو 2 صغيرة', tags: ['global', 'rich-vitC'] },
      { id: 'pineapple', nameAr: 'أناناس طازج مقطع (بروميلين طبيعي)', servingAr: '¾-1 كوب مكعبات', tags: ['global', 'digestive-enzymes'] },
      { id: 'dragon_fruit', nameAr: 'دراجون فروت محلي (فاكهة التنين)', servingAr: '½ حبة متوسطة أو 1 كوب مكعبات', tags: ['tropical'] },
      { id: 'blueberries', nameAr: 'توت أزرق وبلاك بيري وتوت بري', servingAr: '¾ كوب حبات طازجة', tags: ['berries', 'antioxidants'] },

      // الفواكه المجففة وياميش رمضان
      { id: 'raisins_banati', nameAr: 'زبيب بناتي وأسود وصعيدي مجفف', servingAr: '2 ملعقة كبيرة (≈ 20 جم)', tags: ['dried-fruit', 'egyptian'] },
      { id: 'prunes', nameAr: 'قراصيا مجففة (برقوق مجفف للهضم)', servingAr: '2 حبة مجففة متوسطة', tags: ['dried-fruit', 'ramadan'] },
      { id: 'dried_apricots', nameAr: 'مشمشية مجففة طبيعية', servingAr: '2-3 حبات مجففة', tags: ['dried-fruit', 'ramadan'] },
      { id: 'dried_figs', nameAr: 'تين مجفف جبلي طبيعي', servingAr: '1-2 حبة مجففة متوسطة', tags: ['dried-fruit', 'ramadan'] },
    ],
    egyptianExamples: [
      '1 حبة برتقال بلدي أو 2 يوسفي (أفيندي)',
      '1 حبة جوافة بلدي متوسطة (عالية بفيتامين C والألياف)',
      '1 شريحة بطيخ أحمر كبيرة (1¼ كوب مكعبات)',
      '1 كوب كانتالوب أو شمام إسماعيلاوي مقطع',
      '½ حبة مانجو متوسطة أو ½ كوب شرائح',
      '½ حبة رمان بلدي (½ كوب فصوص رمان)',
      '2 حبة تين برشومي طازج',
      '3 حبات بلح رطب أسود أو تمر سيوي وصعيدي',
      '1-2 حبة تين شوكي بلدي طازج',
      '1 كوب حرنكش مصري طازج أو ¾ كوب توت بلدي',
      '3-4 حبات مشمش بلدي أو 1 حبة خوخ سيناوي/برقوق',
      '1 حبة تفاح أو كمثرى بلدي أو ½ حبة موز',
      '12-15 حبة عنب بناتي أو كرمسون',
    ],
    globalExamples: [
      '1 Medium Apple (120g)',
      '1 Small Banana (90g) or ½ Large Banana',
      '1¼ Cup Fresh Whole Strawberries',
      '¾ Cup Fresh Blueberries / Raspberries',
      '¾-1 Cup Fresh Diced Pineapple or Papaya',
      '1-2 Fresh Kiwi Fruits',
      '2 Tablespoons Dried Raisins',
      '2 Dried Prunes or Dried Figs',
    ],
    examples: [
      '1 حبة تفاح أو كمثرى متوسطة',
      '1 حبة برتقال أو 2 يوسفي',
      '1 حبة موز صغيرة أو ½ كبيرة',
      '1 حبة جوافة بلدي متوسطة',
      '1¼ كوب فراولة طازجة (8-10 حبات)',
      '1 كوب مكعبات بطيخ أو شمام',
      '2 حبة تين طازج برشومي',
      '3 حبات تمر أو رطب أسود',
      '1-2 حبة تين شوكي بلدي',
      '1 كوب حرنكش أو ¾ كوب توت بلدي',
      '¾ كوب أناناس أو 1 حبة كيوي كبيرة',
      '½ حبة رمان أو 12 حبة عنب',
    ],
    tips: 'ينصح دائماً بتناول الفواكه كاملة بأليافها الطبيعية الطازجة بدلاً من عصرها لتجنب الارتفاع الحاد في سكر الدم والاستفادة القصوى من فيتامين C والألياف والإنزيمات الهاضمة.',
  },
  {
    id: 'dairy',
    nameAr: 'الحليب والألبان والزبادي والأجبان اللبنية',
    shortName: 'ألبان وزبادي',
    category: 'dairy',
    carbsGrams: 12,
    proteinGrams: 8,
    fatsGrams: 3,
    calories: 110,
    icon: '🥛',
    colorClass: {
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      text: 'text-blue-800 dark:text-blue-200',
      border: 'border-blue-200 dark:border-blue-800/80',
      badge: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200',
    },
    portionUnit: 'حصة ألبان (1 كوب حليب 240 مل أو علبة زبادي 170 جم = 110-120 ك.س)',
    clinicalStandard: 'قوائم الحليب قليل ومنزوع الدسم (ADA / NNI Low-Fat Dairy Exchange)',
    items: [
      { id: 'whole_milk', nameAr: 'لبن حليب بلدي أو معبأ كامل الدسم', servingAr: '1 كوب (240 مل): دهنه أعلى (≈ 150 ك.س)', tags: ['dairy', 'full-fat'] },
      { id: 'lowfat_milk', nameAr: 'لبن حليب قليل الدسم (1.5%) أو خالي الدسم', servingAr: '1 كوب (240 مل)', tags: ['dairy', 'low-fat', 'staple'] },
      { id: 'yogurt_plain', nameAr: 'زبادي بلدي بدون وش أو زبادي طبيعي لايت', servingAr: '1 علبة متوسطة (170 جم / ¾-1 كوب)', tags: ['dairy', 'probiotic', 'staple'] },
      { id: 'greek_yogurt', nameAr: 'زبادي يوناني لايت عالي البروتين', servingAr: '¾ كوب (≈ 150 جم)', tags: ['dairy', 'high-protein', 'global'] },
      { id: 'rayeb', nameAr: 'لبن رايب بلدي أو معبأ قليل/خالي الدسم', servingAr: '1 كوب (200-240 مل)', tags: ['egyptian', 'dairy', 'probiotic', 'staple'] },
      { id: 'labneh', nameAr: 'لبنة بلدية بالزعتر وزيت خفيف', servingAr: '2 ملعقة كبيرة (≈ 40 جم)', tags: ['dairy', 'mediterranean', 'arab'] },
      { id: 'qareesh_dairy', nameAr: 'جبنة قريش فلاحي طبيعية', servingAr: '¼-½ كوب (تحسب كبروتين خفيف أو ألبان حسب التوزيع)', tags: ['egyptian', 'dairy', 'staple'] },
      { id: 'white_cheese', nameAr: 'جبنة بيضاء طبيعية قليلة الملح والدسم', servingAr: '≈ 30 جم (شريحة بحجم علبة كبريت)', tags: ['egyptian', 'dairy'] },
      { id: 'domiati', nameAr: 'جبنة دمياطي / براميلي قليلة الدسم (ملح أعلى)', servingAr: '≈ 30 جم', tags: ['egyptian', 'high-sodium'] },
      { id: 'rumi_cheese_dairy', nameAr: 'جبنة رومي / تركي (دهون وأملاح أعلى)', servingAr: '≈ 20-30 جم (توزع كبروتين متوسط + دهن)', tags: ['egyptian', 'high-fat'] },
      { id: 'mish', nameAr: 'مش فلاحي مختمر (نكهة قوية وملح عالي)', servingAr: 'كمية صغيرة جداً للتذوق', tags: ['egyptian', 'high-sodium', 'traditional'] },
      { id: 'kishk_dairy', nameAr: 'كشك مصري مطبوخ باللبن والزبادي', servingAr: 'طبق صغير (نشا + ألبان)', tags: ['egyptian', 'traditional'] },
      { id: 'soy_milk_fortified', nameAr: 'حليب صويا غير محلى مدعم بالكالسيوم', servingAr: '1 كوب (240 مل)', tags: ['dairy-free', 'vegan'] },
      { id: 'almond_milk_fortified', nameAr: 'حليب لوز غير محلى مدعم', servingAr: '1.5 كوب (منخفض البروتين)', tags: ['dairy-free', 'vegan'] },
    ],
    egyptianExamples: [
      '1 كوب لبن حليب بقري مغلي ومنزوع الوش (240 مل)',
      '1 كوب لبن رايب بلدي طازج قليل الدسم (200-240 مل)',
      '1 علبة زبادي بلدي بدون وش أو زبادي لايت (170 جم)',
      '¾ كوب زبادي يوناني لايت طبيعي (150 جم)',
      '¼-½ كوب جبنة قريش فلاحي مصري',
      '30 جم جبنة بيضاء أو دمياطي لايت قليلة الملح',
    ],
    globalExamples: [
      '1 Cup Skim / 1% Low-Fat Cow Milk (240ml)',
      '1 Container Low-Fat Plain Yogurt (170g / 6oz)',
      '¾ Cup Plain Non-Fat Greek Yogurt (150g)',
      '1 Cup Plain Fortified Soy Milk (Unsweetened)',
      '1 Cup Kefir / Probiotic Fermented Milk (200ml)',
      '2 Tablespoons Low-Fat Labneh (40g)',
    ],
    examples: [
      '1 كوب حليب قليل أو خالي الدسم (240 مل)',
      '1 علبة زبادي طبيعي لايت (170 جم)',
      '1 كوب لبن رايب طازج خالي الدسم',
      '¾ كوب زبادي يوناني لايت عالي البروتين',
      '1 كوب حليب صويا أو لوز غير محلى مدعم',
    ],
    tips: 'الزبادي واللبن الرايب واللبنة غنية بالبروبيوتيك والخمائر النافعة التي تدعم فلورا الأمعاء وتمنع الانتفاخات وتحسن الهضم والامتصاص.',
  },
  {
    id: 'fats',
    nameAr: 'الدهون الصحية والزيوت والمكسرات والبذور',
    shortName: 'دهون صحية',
    category: 'fat',
    carbsGrams: 0,
    proteinGrams: 0,
    fatsGrams: 5,
    calories: 45,
    icon: '🥑',
    colorClass: {
      bg: 'bg-peacock-mist dark:bg-peacock-ink-deep/40',
      text: 'text-peacock-indigo-deep dark:text-peacock-sage',
      border: 'border-peacock-sage dark:border-peacock-indigo-deep/80',
      badge: 'bg-peacock-pale text-peacock-ink dark:bg-peacock-ink/60 dark:text-peacock-sage',
    },
    portionUnit: 'حصة دهون (5 جم دهون نقية = 45 ك.س)',
    clinicalStandard: 'قوائم الزيوت والدهون غير المشبعة الأحادية والمتعددة (ADA / NNI Fat Exchange)',
    items: [
      { id: 'olive_oil', nameAr: 'زيت زيتون بكر ممتاز نقي معصور على البارد', servingAr: '1 ملعقة صغيرة (5 مل = 5 جم)', tags: ['oil', 'monounsaturated', 'staple'] },
      { id: 'flaxseed_oil', nameAr: 'زيت حار مصري (زيت بذرة الكتان غني بأوميجا-3)', servingAr: '1 ملعقة صغيرة (5 مل)', tags: ['egyptian', 'oil', 'omega3', 'staple'] },
      { id: 'corn_oil', nameAr: 'زيت ذرة أو عباد شمس أو كانولا نقي', servingAr: '1 ملعقة صغيرة (5 مل)', tags: ['oil', 'polyunsaturated'] },
      { id: 'ghee', nameAr: 'سمن بلدي فلاحي طبيعي نقي', servingAr: '1 ملعقة صغيرة (5 جم)', tags: ['egyptian', 'saturated_natural'] },
      { id: 'butter', nameAr: 'زبدة فلاحي طبيعية نقية', servingAr: '1 ملعقة صغيرة (5 جم)', tags: ['egyptian', 'saturated_natural'] },
      { id: 'tahini', nameAr: 'طحينة سمسم بيضاء نقية (بدون دقيق مضاف)', servingAr: '1-2 ملعقة صغيرة (≈ 10 جم)', tags: ['egyptian', 'staple', 'sesame'] },
      { id: 'olives', nameAr: 'زيتون أخضر أو أسود مخلل قليل الملح', servingAr: '8-10 حبات متوسطة', tags: ['egyptian', 'mediterranean', 'staple'] },
      { id: 'avocado', nameAr: 'أفوكادو طازج مهروس', servingAr: '2 ملعقة كبيرة مهروس أو ⅛ حبة متوسطة (≈ 30 جم)', tags: ['global', 'monounsaturated'] },
      { id: 'peanuts', nameAr: 'فول سوداني مقشر محمص أو نيء غير مملح', servingAr: '10-20 حبة (≈ 10-12 جم)', tags: ['egyptian', 'nuts', 'staple'] },
      { id: 'almonds', nameAr: 'لوز نيء / كاجو / بندق غير مملح', servingAr: '6 حبات كاملة (≈ 10 جم)', tags: ['nuts', 'healthy'] },
      { id: 'walnuts', nameAr: 'عين جمل (جوز) كامل الحبة غني بأوميجا-3', servingAr: '2 حبة كاملة (4 أنصاف)', tags: ['nuts', 'omega3'] },
      { id: 'pistachios', nameAr: 'فستق حلبي نيء غير مملح', servingAr: '15-18 حبة', tags: ['nuts', 'arab'] },
      { id: 'pine_nuts', nameAr: 'صنوبر بلدي نيء', servingAr: '1 ملعقة كبيرة', tags: ['nuts', 'arab'] },
      { id: 'sesame', nameAr: 'سمسم أبيض أو محمص / بذور كتان مطحونة', servingAr: '1 ملعقة كبيرة (≈ 10 جم)', tags: ['seeds', 'egyptian'] },
      { id: 'chia_seeds', nameAr: 'بذور شيا / بذور قرع عسلي (لب أبيض غير مملح)', servingAr: '1 ملعقة كبيرة ممتلئة', tags: ['seeds', 'egyptian', 'superfood'] },
      { id: 'sunflower_seeds', nameAr: 'لب سوري (بذور عباد شمس) مقشر غير مملح', servingAr: '1 ملعقة كبيرة ممتلئة', tags: ['seeds', 'egyptian'] },
      { id: 'eshta', nameAr: 'قشطة فلاحي بلدي طبيعية من وش اللبن', servingAr: '1 ملعقة صغيرة (5-8 جم)', tags: ['egyptian', 'traditional', 'saturated'] },
      { id: 'peanut_butter', nameAr: 'زبدة فول سوداني نقية 100% بدون سكر أو زيت مهدرج', servingAr: '1 ملعقة صغيرة ممتلئة (≈ 8-10 جم)', tags: ['nuts', 'staple'] },
    ],
    egyptianExamples: [
      '1 ملعقة صغيرة زيت زيتون بكر ممتاز (5 مل)',
      '1 ملعقة صغيرة زيت حار مصري (بذرة الكتان)',
      '1-2 ملعقة صغيرة طحينة سمسم بيضاء نقية',
      '1 ملعقة صغيرة سمن بلدي طبيعي أو زبدة فلاحي',
      '8 إلى 10 حبات زيتون أسود أو أخضر قليل الملح',
      '15-20 حبة فول سوداني محمص غير مملح',
      '1 ملعقة كبيرة لب أبيض مقشر (بذور قرع عسلي) أو لب سوري',
      '1 ملعقة كبيرة سمسم أو بذور كتان مطحونة',
      '1 ملعقة صغيرة قشطة بلدي طبيعية',
    ],
    globalExamples: [
      '1 Teaspoon Extra Virgin Olive Oil (5ml)',
      '6 Raw Whole Almonds or Cashews or Hazelnuts (10g)',
      '2 Whole English Walnuts (4 Halves)',
      '2 Tablespoons Mashed Avocado (or ⅛ Medium Avocado ~30g)',
      '1 Tablespoon Whole Chia Seeds or Ground Flaxseeds',
      '1 Teaspoon Pure Peanut Butter or Almond Butter (No added sugar)',
      '8-10 Pitted Kalamata / Green Olives',
    ],
    examples: [
      '1 ملعقة صغيرة زيت زيتون بكر ممتاز (5 مل)',
      '1 ملعقة صغيرة زيت حار (بذر الكتان) أو زيت ذرة',
      '1-2 ملعقة صغيرة طحينة سمسم بيضاء نقية',
      '6 حبات لوز أو كاجو أو بندق نيء (10 جم)',
      '2 حبة عين جمل كاملة (جوز)',
      '15-20 حبة فول سوداني محمص غير مملح',
      '⅛ حبة أفوكادو متوسطة (30 جم)',
      '1 ملعقة كبيرة بذور شيا أو بذر كتان أو لب أبيض',
      '8-10 حبات زيتون أسود أو أخضر قليل الملح',
      '1 ملعقة صغيرة سمن بلدي طبيعي أو زبدة فلاحي',
    ],
    tips: 'الدهون الصحية غير المشبعة ضرورية لامتصاص الفيتامينات الذائبة في الدهون (A, D, E, K) وتخليق الهرمونات الحيوية والشعور بالشبع طويل المدى.',
  },
];

export interface MealExchangeTotals {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatsGrams: number;
}

/**
 * Calculates total macros & calories from exchange quantities for a single meal
 */
export function calculateMealExchangeMacros(exchanges?: Record<string, number>): MealExchangeTotals {
  if (!exchanges) {
    return { calories: 0, proteinGrams: 0, carbsGrams: 0, fatsGrams: 0 };
  }

  let calories = 0;
  let proteinGrams = 0;
  let carbsGrams = 0;
  let fatsGrams = 0;

  FOOD_EXCHANGE_GROUPS.forEach((group) => {
    const qty = exchanges[group.id] || 0;
    if (qty > 0) {
      calories += group.calories * qty;
      proteinGrams += group.proteinGrams * qty;
      carbsGrams += group.carbsGrams * qty;
      fatsGrams += group.fatsGrams * qty;
    }
  });

  return {
    calories: Math.round(calories),
    proteinGrams: Math.round(proteinGrams),
    carbsGrams: Math.round(carbsGrams),
    fatsGrams: Math.round(fatsGrams),
  };
}

/**
 * Calculates cumulative exchange counts and macros across all meals in a plan draft
 */
export function calculatePlanTotalExchanges(meals: Array<{ exchanges?: Record<string, number> }>): {
  totalExchanges: Record<string, number>;
  totals: MealExchangeTotals;
} {
  const totalExchanges: Record<string, number> = {};

  FOOD_EXCHANGE_GROUPS.forEach((g) => {
    totalExchanges[g.id] = 0;
  });

  meals.forEach((m) => {
    if (m.exchanges) {
      Object.entries(m.exchanges).forEach(([groupId, qty]) => {
        if (typeof qty === 'number' && qty > 0) {
          totalExchanges[groupId] = (totalExchanges[groupId] || 0) + qty;
        }
      });
    }
  });

  const totals = calculateMealExchangeMacros(totalExchanges);

  return { totalExchanges, totals };
}

/**
 * Smart generator that turns exchange allocations into readable Arabic meal text & 3 structured realistic alternatives
 */
export function generateMealContentFromExchanges(exchanges?: Record<string, number>): {
  primaryItems: string;
  alternatives: string[];
} {
  if (!exchanges || Object.values(exchanges).every((v) => !v || v <= 0)) {
    return {
      primaryItems: '',
      alternatives: [],
    };
  }

  // 1. Primary Set (Classic Balanced / مصري متوازن)
  const primaryParts: string[] = [];
  // 2. Alt 1 Set (Quick & Fit / عملي وصحي)
  const alt1Parts: string[] = [];
  // 3. Alt 2 Set (High Fiber & Satiety / غني بالألياف والشبع)
  const alt2Parts: string[] = [];
  // 4. Alt 3 Set (Traditional Variety / تشكيلة متنوعة)
  const alt3Parts: string[] = [];

  FOOD_EXCHANGE_GROUPS.forEach((group) => {
    const qty = exchanges[group.id] || 0;
    if (qty <= 0) return;

    if (group.id === 'starches') {
      if (qty === 0.5) {
        primaryParts.push('¼ رغيف بلدي صغير');
        alt1Parts.push('1 كعكة أرز (Rice Cake)');
        alt2Parts.push('1.5 ملعقة كبيرة شوفان جاف');
        alt3Parts.push('50 جم بطاطس مسلوقة أو 2 م.ك فول مدمس');
      } else if (qty === 1) {
        primaryParts.push('¼ رغيف بلدي كبير (أو ½ صغير ≈ 30 جم)');
        alt1Parts.push('1 شريحة توست أسمر كامل الحبوب');
        alt2Parts.push('½ كوب شوفان مطبوخ أو 3 م.ك شوفان جاف');
        alt3Parts.push('⅓ كوب أرز مصري مسلوق (أو 4 ملاعق كبيرة فول مدمس/حمص مسلوق)');
      } else if (qty === 2) {
        primaryParts.push('½ رغيف بلدي كبير كامل (أو 1 صغير)');
        alt1Parts.push('2 شريحة توست أسمر حبوب كاملة');
        alt2Parts.push('1 كوب شوفان مطبوخ (أو 6 ملاعق شوفان)');
        alt3Parts.push('6 ملاعق كبيرة أرز مطبوخ أو مكرونة أو فريك أو طبق فول مدمس صغير');
      } else {
        primaryParts.push(`${qty / 2} رغيف بلدي كبير (${qty} حصص نشويات)`);
        alt1Parts.push(`${qty} شرائح توست أسمر`);
        alt2Parts.push(`${qty * 3} ملاعق كبيرة أرز أو مكرونة مسلوقة`);
        alt3Parts.push(`${qty * 100} جم بطاطس مسلوقة أو بطاطا حلوة مشوية أو ${qty * 3} ملاعق بقوليات مسلوقة`);
      }
    } else if (group.id === 'lean_protein') {
      const grams = Math.round(qty * 30);
      const cottageGrams = Math.round(qty * 45);

      if (qty <= 1) {
        primaryParts.push(`${cottageGrams} جم جبن قريش فلاحي مصري`);
        alt1Parts.push(`${grams} جم صدور دجاج مشوية بدون جلد`);
        alt2Parts.push(`${grams} جم سمك بلطي أو تونة مصفاة ومغسولة`);
        alt3Parts.push('2 بياض بيض كبير مسلوق');
      } else if (qty === 2) {
        primaryParts.push(`${grams} جم صدور دجاج مشوية بالليمون`);
        alt1Parts.push(`${cottageGrams} جم جبنة قريش بالزعتر وزيت خفيف`);
        alt2Parts.push(`${grams} جم سمك بلطي أو قشر بياض مشوي بالردة`);
        alt3Parts.push(`${grams} جم تونة مصفاة من الزيت`);
      } else {
        primaryParts.push(`${grams} جم صدور دجاج مخلية مشوية`);
        alt1Parts.push(`${grams} جم سمك بلطي أو قشر بياض مشوي بالردة`);
        alt2Parts.push(`${cottageGrams} جم جبن قريش طبيعي`);
        alt3Parts.push(`${grams} جم تونة لحم خفيف مصفاة أو جمبري مسلوق`);
      }
    } else if (group.id === 'med_protein') {
      const grams = Math.round(qty * 30);
      if (qty === 1) {
        primaryParts.push('1 حبة بيض كاملة مسلوقة');
        alt1Parts.push('30 جم جبن فيتا لايت قليل الملح');
        alt2Parts.push('30 جم لحم بقر كنداك مشوي');
        alt3Parts.push('30 جم سمك بوري أو سلمون مشوي بالردة');
      } else if (qty === 2) {
        primaryParts.push('2 حبة بيض مسلوقة (أو أومليت خفيف)');
        alt1Parts.push('60 جم جبن فيتا لايت أو موزاريلا لايت');
        alt2Parts.push('60 جم لحم بقر كنداك أو كفتة مشوية بيتي');
        alt3Parts.push('60 جم سمك بوري أو سلمون مشوي بالردة والليمون');
      } else {
        primaryParts.push(`${grams} جم لحم بقر أحمر مسلوق أو مشوي`);
        alt1Parts.push(`${qty} حبات بيض مسلوق`);
        alt2Parts.push(`${grams} جم كفتة حاتي مشوية بيتي`);
        alt3Parts.push(`${grams} جم سمك بوري أو ماكريل مشوي`);
      }
    } else if (group.id === 'vegetables') {
      if (qty === 1) {
        primaryParts.push('1 طبق سلطة خضراء بلدي طازج (خيار، طماطم، جرجير، خس)');
        alt1Parts.push('½ كوب ملوخية مصرية خفيفة');
        alt2Parts.push('½ كوب كوسة أو بامية مطبوخة ني في ني');
        alt3Parts.push('1 كوب خيار وفاقوس وخس وجرجير طازج');
      } else {
        primaryParts.push(`1 طبق سلطة خضراء كبير + ${qty - 1} حصة خضار سوتيه/مطبوخ`);
        alt1Parts.push(`1 طبق سلطة + ${qty - 1} حصة ملوخية أو بامية`);
        alt2Parts.push(`${qty * 0.5} كوب خضار مشكل مطبوخ بدون دهون (كوسة، فاصوليا خضراء، بروكلي)`);
        alt3Parts.push(`طبق سلطة خضراء بلدي مع ${qty * 100} جم باذنجان أو قرنبيط مشوي بالفرن`);
      }
    } else if (group.id === 'fruits') {
      if (qty === 1) {
        primaryParts.push('1 حبة تفاح متوسطة (أو برتقالة بلدية)');
        alt1Parts.push('1 كوب فراولة طازجة أو جوافة بلدي');
        alt2Parts.push('1 حبة موز صغيرة أو 2 يوسفي');
        alt3Parts.push('1 شريحة بطيخ كبيرة (أو 2 تين برشومي أو 3 تمرات/بلح رطب أو 1 كوب حرنكش)');
      } else {
        primaryParts.push(`${qty} ثمار فاكهة طازجة (تفاح / برتقال / جوافة)`);
        alt1Parts.push(`${qty} كوب فراولة أو أناناس أو توت بلدي طازج`);
        alt2Parts.push(`${qty * 3} حبات بلح رطب أو تمر سيوي/صعيدي`);
        alt3Parts.push(`${qty} شريحة بطيخ أو كوب كانتالوب/شمام أو تين شوكي`);
      }
    } else if (group.id === 'dairy') {
      if (qty === 1) {
        primaryParts.push('1 كوب حليب قليل الدسم (240 مل)');
        alt1Parts.push('1 علبة زبادي طبيعي لايت (170 جم)');
        alt2Parts.push('1 كوب لبن رايب بلدي طازج');
        alt3Parts.push('¾ كوب زبادي يوناني لايت أو 2 ملعقة كبيرة لبنة بالزعتر');
      } else {
        primaryParts.push(`${qty} كوب حليب قليل الدسم`);
        alt1Parts.push(`${qty} علبة زبادي لايت`);
        alt2Parts.push(`${qty} كوب لبن رايب طازج`);
        alt3Parts.push(`${qty * 0.75} كوب زبادي يوناني لايت`);
      }
    } else if (group.id === 'fats') {
      if (qty === 1) {
        primaryParts.push('1 ملعقة صغيرة زيت زيتون بكر');
        alt1Parts.push('1 ملعقة صغيرة طحينة سمسم بيضاء');
        alt2Parts.push('6 حبات لوز نيء (أو 2 حبة جوز عين جمل أو 15 حبة فول سوداني)');
        alt3Parts.push('1 ملعقة صغيرة زيت حار (بذر الكتان) أو 8 حبات زيتون');
      } else if (qty === 2) {
        primaryParts.push('2 ملعقة صغيرة زيت زيتون بكر');
        alt1Parts.push('2 ملعقة صغيرة طحينة بيضاء');
        alt2Parts.push('12 حبة لوز نيء (20 جم)');
        alt3Parts.push('¼ حبة أفوكادو متوسطة (40 جم) أو ملعقة كبيرة لب أبيض مقشر');
      } else {
        primaryParts.push(`${qty} ملاعق صغيرة زيت زيتون (${qty * 5} مل)`);
        alt1Parts.push(`${qty} ملاعق صغيرة طحينة سمسم بيضاء`);
        alt2Parts.push(`${qty * 6} حبات لوز أو مكسرات نية`);
        alt3Parts.push(`${qty * 15} حبة فول سوداني غير مملح`);
      }
    }
  });

  const primaryItems = primaryParts.join(' + ');
  const alternatives: string[] = [];

  if (alt1Parts.length > 0) {
    alternatives.push(alt1Parts.join(' + '));
  }
  if (alt2Parts.length > 0) {
    alternatives.push(alt2Parts.join(' + '));
  }
  if (alt3Parts.length > 0) {
    alternatives.push(alt3Parts.join(' + '));
  }

  return { primaryItems, alternatives };
}
