const fs = require('fs');
const path = require('path');

// Keep Material 3 tabs native while applying the compact Android geometry and
// distinct inactive/active label weights used by the app.
const applicatorPath = path.resolve(
  __dirname,
  '../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/gamma/tabs/appearance/TabsAppearanceApplicator.kt',
);
const bottomNavigationPath = path.resolve(
  __dirname,
  '../node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/gamma/tabs/container/CustomBottomNavigationView.kt',
);

if (!fs.existsSync(applicatorPath) || !fs.existsSync(bottomNavigationPath)) {
  console.warn('React Native Screens native-tabs patch skipped: installed sources not found.');
  process.exit(0);
}

let source = fs.readFileSync(applicatorPath, 'utf8');
const marker = 'Tonikah: use separate inactive and active tab-label weights.';

const originalWeight = `            val fontWeight =
                if (tabBarAppearance?.tabBarItemTitleFontWeight ==
                    "bold"
                ) {
                    700
                } else {
                    tabBarAppearance?.tabBarItemTitleFontWeight?.toIntOrNull() ?: 400
                }

            val fontFamily =
                ReactFontManager.getInstance().getTypeface(
                    tabBarAppearance?.tabBarItemTitleFontFamily ?: "",
                    fontWeight,
                    isFontStyleItalic,
                    context.assets,
                )`;

const replacementWeight = `            // ${marker}
            val inactiveFontWeight =
                if (tabBarAppearance?.tabBarItemTitleFontWeight ==
                    "bold"
                ) {
                    700
                } else {
                    tabBarAppearance?.tabBarItemTitleFontWeight?.toIntOrNull() ?: 400
                }
            val activeFontWeight = 700
            val fontFamilyName = tabBarAppearance?.tabBarItemTitleFontFamily ?: ""

            val inactiveFontFamily =
                ReactFontManager.getInstance().getTypeface(
                    fontFamilyName,
                    inactiveFontWeight,
                    isFontStyleItalic,
                    context.assets,
                )
            val activeFontFamily =
                ReactFontManager.getInstance().getTypeface(
                    fontFamilyName,
                    activeFontWeight,
                    isFontStyleItalic,
                    context.assets,
                )`;

const originalInactiveAssignment = '            smallLabel.typeface = fontFamily';
const replacementInactiveAssignment = '            smallLabel.typeface = inactiveFontFamily';
const originalActiveAssignment = '            largeLabel.typeface = fontFamily';
const replacementActiveAssignment = '            largeLabel.typeface = activeFontFamily';

if (source.includes(marker)) {
  console.log('React Native Screens tab-label weight patch already applied.');
} else {
  if (
    !source.includes(originalWeight) ||
    !source.includes(originalInactiveAssignment) ||
    !source.includes(originalActiveAssignment)
  ) {
    console.warn('React Native Screens tab-label patch skipped: installed source has changed.');
    process.exit(0);
  }

  source = source.replace(originalWeight, replacementWeight);
  source = source.replace(originalInactiveAssignment, replacementInactiveAssignment);
  source = source.replace(originalActiveAssignment, replacementActiveAssignment);

  fs.writeFileSync(applicatorPath, source, 'utf8');
  console.log('Patched React Native Screens native tab-label weights.');
}

let bottomNavigationSource = fs.readFileSync(bottomNavigationPath, 'utf8');
const spacingMarker = 'Tonikah: fixed 68dp content height with 12dp top and 0dp bottom item padding.';
const previousSpacingMarker = 'Tonikah: 68dp navigation bar with 12dp top and 0dp bottom padding.';
const originalClassBody = `) : BottomNavigationView(context) {
    private var actionOrigin: TabsActionOrigin? = null`;
const replacementClassBody = `) : BottomNavigationView(context) {
    private val compactContentHeight = (68 * resources.displayMetrics.density + 0.5f).toInt()

    init {
        // ${spacingMarker}
        val density = resources.displayMetrics.density
        minimumHeight = compactContentHeight
        setItemPaddingTop((12 * density + 0.5f).toInt())
        setItemPaddingBottom(0)
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
        setMeasuredDimension(measuredWidth, compactContentHeight + paddingBottom)
    }

    private var actionOrigin: TabsActionOrigin? = null`;
const previousClassBody = `) : BottomNavigationView(context) {
    init {
        // ${previousSpacingMarker}
        val density = resources.displayMetrics.density
        minimumHeight = (68 * density + 0.5f).toInt()
        setItemPaddingTop((12 * density + 0.5f).toInt())
        setItemPaddingBottom(0)
    }

    private var actionOrigin: TabsActionOrigin? = null`;

if (bottomNavigationSource.includes(spacingMarker)) {
  console.log('React Native Screens compact tab-bar spacing patch already applied.');
} else if (bottomNavigationSource.includes(previousClassBody)) {
  bottomNavigationSource = bottomNavigationSource.replace(previousClassBody, replacementClassBody);
  fs.writeFileSync(bottomNavigationPath, bottomNavigationSource, 'utf8');
  console.log('Updated React Native Screens native tab bar to a fixed 68dp content height.');
} else {
  if (!bottomNavigationSource.includes(originalClassBody)) {
    console.warn('React Native Screens tab-bar spacing patch skipped: installed source has changed.');
    process.exit(0);
  }

  bottomNavigationSource = bottomNavigationSource.replace(originalClassBody, replacementClassBody);
  fs.writeFileSync(bottomNavigationPath, bottomNavigationSource, 'utf8');
  console.log('Patched React Native Screens compact native tab-bar spacing.');
}
