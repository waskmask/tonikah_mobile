import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Baby,
  BookHeart,
  BriefcaseBusiness,
  Building2,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Cigarette,
  Coins,
  GraduationCap,
  Heart,
  Home,
  Languages,
  Lock,
  MapPin,
  Mic,
  Moon,
  Plane,
  Puzzle,
  Ruler,
  ShieldCheck,
  Shirt,
  Sparkles,
  UserCog,
  UserRound,
  Users,
  Wine,
} from "lucide-react-native";

import { AppBackTitleBar } from "@/components/app/AppBackTitleBar";
import { EditProfileMediaEditor } from "@/components/profile/EditProfileMediaEditor";
import { ProfileCompletionBar } from "@/components/profile/ProfileCompletionBar";
import { ProfileSummaryEditor, type ProfileSummaryEditorHandle } from "@/components/profile/ProfileSummaryEditor";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { IncomeEditSheet } from "@/components/ui/IncomeEditSheet";
import { MultiSelectOption, MultiSelectSheet } from "@/components/ui/MultiSelectSheet";
import { SelectOption, SingleSelectSheet } from "@/components/ui/SingleSelectSheet";
import { Text } from "@/components/ui/Text";
import { TextEditSheet } from "@/components/ui/TextEditSheet";
import { COUNTRY_OPTIONS, LANGUAGE_OPTIONS, NATIONALITY_OPTIONS } from "@/constants/profileOptions";
import { Typography } from "@/constants/typography";
import { useEmailVerificationGuard } from "@/hooks/useEmailVerificationGuard";
import { useLanguage } from "@/hooks/useLanguage";
import { useMasterdataLists } from "@/hooks/useMasterdataLists";
import { useResponsive } from "@/hooks/useResponsive";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { useUnsavedNavigationGuard } from "@/hooks/useUnsavedNavigationGuard";
import { type GalleryItem, type GalleryPrivacy, type GalleryResponse } from "@/lib/galleryService";
import {
  buildMissingImpactGroups,
  calculateWeightedMissingImpacts,
} from "@/lib/profileCompletionImpact";
import { emojiChipItem } from "@/lib/profileEmoji";
import { formatProfileOptionLabel } from "@/lib/profileOptionLabels";
import {
  apiMessage,
  cleanProfileText,
  displayText,
  selectLabel,
  t as translateText,
  translateCountry,
} from "@/lib/profileDisplay";
import { profileService } from "@/lib/profileService";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import {
  extractModerationRejection,
  getTextModerationWarning,
  moderationCandidateForEditing,
  pendingModerationCandidate,
  type TextModerationWarning,
} from "@/lib/textModeration";
import { TextModerationWarningModal } from "@/components/app/TextModerationWarningModal";
import { UnderReviewPill } from "@/components/app/UnderReviewPill";
import {
  cleanHeadlineTextForSave,
  COMPANY_MAX,
  countNonSpace,
  formatAmount,
  isAllowedProfileText,
  MAX_INCOME,
  parseAmount,
} from "@/lib/profileValidation";
import { useAuthStore } from "@/store/authStore";

type PlaceDetails = {
  place_id?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
};

type CompletionState = {
  percent: number;
  completed: number;
  total: number;
  missingKeys: string[];
};

type FieldRow = {
  id: string;
  label: string;
  value: string;
  completionKey?: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Locked fields show a lock and cannot be edited (web parity: grew_up_in). */
  locked?: boolean;
  /** Non-interactive "Under review" pill on the row (web parity: company). */
  pendingReview?: boolean;
};

const NOT_SET = "Not set";
const PRIMARY = "#F34B6F";

const themeColors = (isDark: boolean) => ({
  background: isDark ? "#211D18" : "#F7F3ED",
  surface: isDark ? "#141210" : "#FFFFFF",
  card: isDark ? "#1B1713" : "#F7F3ED",
  border: isDark ? "#3A332B" : "#E8E1D6",
  text: isDark ? "#F7F3ED" : "#201B15",
  muted: isDark ? "#A99C8D" : "#7D7266",
  primary: PRIMARY,
});

const completionFields = (gender?: string | null) => {
  const base = [
    "profileName",
    "gender",
    "dob",
    "nationality",
    "grew_up_in",
    "mother_tongue",
    "languages_spoken",
    "born_muslim",
    "height",
    "complexion",
    "ethnic_group",
    "marital_status",
    "have_children",
    "wants_children",
    "marriage_plan",
    "relocation_plans",
    "education",
    "occupation",
    "current_location",
    "sect",
    "maslak",
    "is_practising",
    "prayers",
    "smoking",
    "alcohol",
    "avatar",
    "gallery",
    "bio",
    "profile_headline",
    "profile_manager",
    "hobbies",
  ];

  if (String(gender || "").toLowerCase() === "female") {
    base.splice(8, 0, "i_usually_dress");
  }

  return base;
};

const hasValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return Boolean(value);

  const objectValue = value as Record<string, unknown>;
  return Boolean(
    objectValue.value_id ||
      objectValue.id ||
      objectValue.uuid ||
      objectValue.label ||
      objectValue.name ||
      objectValue.en ||
      objectValue.city ||
      objectValue.country ||
      objectValue.place_id,
  );
};

const localCompletion = (profile: any, gallery: GalleryItem[]): CompletionState => {
  const gender = profile?.gender;
  const keys = completionFields(gender);
  const checks: Record<string, boolean> = {
    profileName: hasValue(profile?.profileName || profile?.profile_name),
    gender: hasValue(profile?.gender),
    dob: hasValue(profile?.dob),
    nationality: hasValue(profile?.nationality),
    grew_up_in: hasValue(profile?.grew_up_in),
    mother_tongue: hasValue(profile?.mother_tongue),
    languages_spoken: hasValue(profile?.languages_spoken),
    born_muslim: hasValue(profile?.born_muslim),
    i_usually_dress: hasValue(profile?.i_usually_dress),
    height: hasValue(profile?.height),
    complexion: hasValue(profile?.complexion),
    ethnic_group: hasValue(profile?.ethnic_group),
    marital_status: hasValue(profile?.marital_status),
    have_children: hasValue(profile?.have_children),
    wants_children: hasValue(profile?.wants_children),
    marriage_plan: hasValue(profile?.marriage_plan),
    relocation_plans: hasValue(profile?.relocation_plans),
    education: hasValue(profile?.education),
    occupation: hasValue(profile?.occupation),
    current_location: hasValue(profile?.current_location),
    sect: hasValue(profile?.sect),
    maslak: hasValue(profile?.maslak),
    is_practising: hasValue(profile?.is_practising),
    prayers: hasValue(profile?.prayers),
    smoking: hasValue(profile?.smoking),
    alcohol: hasValue(profile?.alcohol),
    avatar: hasValue(profile?.avatar) || gallery.some((item) => item.isPrimary),
    gallery: gallery.length > 0,
    bio: hasValue(profile?.bio),
    profile_headline: hasValue(profile?.profile_headline),
    profile_manager: hasValue(profile?.profile_manager),
    hobbies: hasValue(profile?.hobbies),
  };

  const completed = keys.filter((key) => checks[key]).length;
  const total = keys.length;
  return {
    percent: total ? Math.round((completed / total) * 100) : 0,
    completed,
    total,
    missingKeys: keys.filter((key) => !checks[key]),
  };
};

const formatList = (value: unknown, fallback: string) => {
  if (!Array.isArray(value)) return fallback;
  const labels = value
    .map((item) => selectLabel(item) || (typeof item === "string" ? displayText(item) : ""))
    .filter(Boolean);
  return labels.length ? labels.join(", ") : fallback;
};

const formatSelect = (value: unknown, fallback: string) =>
  selectLabel(value) || displayText(value) || fallback;

const countryValue = (value: unknown) => {
  const candidates = typeof value === "object" && value !== null
    ? [
        (value as any).label,
        (value as any).name,
        (value as any).value,
        (value as any).value_id,
      ]
    : [value];
  const raw = candidates
    .map((candidate) => String(candidate || "").trim())
    .find((candidate) => candidate && !/^[a-f\d]{24}$/i.test(candidate));
  return raw ? translateCountry(raw) : "";
};

const formatCountryList = (value: unknown, fallback: string) => {
  if (!Array.isArray(value)) return fallback;
  const labels = value.map(countryValue).filter(Boolean);
  return labels.length ? labels.join(", ") : fallback;
};

const formatLocation = (location: any, locale: string, fallback: string) => {
  if (!location) return fallback;
  const country = translateCountry(String(location.country || "")) || location.country;
  const parts = [location.city].filter(Boolean);
  if (country) parts.push(country);
  return parts.length ? parts.join(", ") : fallback;
};

const formatIncome = (income: any, fallback: string) => {
  if (!income?.amount) return fallback;
  const currency = income.currency ? `${income.currency} ` : "";
  return `${currency}${Number(income.amount).toLocaleString()}`;
};


const MASTER_FIELDS = new Set([
  "height",
  "complexion",
  "ethnic_group",
  "education",
  "occupation",
  "designation",
  "sect",
  "maslak",
  "following",
]);

const MASTER_TYPES = [
  "height",
  "complexion",
  "ethnic_group",
  "education",
  "occupation",
  "designation",
  "sect",
  "maslak",
  "following",
] as const;

const SECT_FILTERS: Record<string, { maslak: string[]; following: string[] }> = {
  sunni: {
    maslak: ["hanafi", "shafi", "maliki", "hanbali", "not_applicable"],
    following: [
      "ahle_hadith",
      "ahle_sunnat",
      "deobandi",
      "barelvi",
      "sufi",
      "tabligi",
      "salafi",
      "just_muslim",
      "other_sunni",
    ],
  },
  shia: {
    maslak: ["jafari", "zaydi", "ismaili", "other"],
    following: ["ithna_ashari", "bohra", "ismaili", "zaidi", "just_shia", "other_shia"],
  },
  ibadi: {
    maslak: ["not_applicable", "other"],
    following: ["ahle_hadith", "ahle_sunnat", "salafi", "just_muslim", "other_sunni"],
  },
};

const PROFILE_MANAGER_OPTIONS = ["self", "father", "mother", "brother", "sister", "relative", "friend"] as const;

const normalizeMasterKey = (value?: string) =>
  String(value || "")
    .trim()
    .toLowerCase();

const fieldValueId = (value: any) =>
  String(value?.value_id || value?._id || value?.id || value?.uuid || (typeof value === "string" ? value : "")).trim();

const fieldValueIds = (value: any) => (Array.isArray(value) ? value.map(fieldValueId).filter(Boolean) : []);

const hasResolvedLocation = (details: PlaceDetails | undefined) => {
  if (!details) return false;
  const lat = Number(details.lat);
  const lng = Number(details.lng);

  return Boolean(
    details.place_id &&
      details.city?.trim() &&
      details.countryCode?.trim().match(/^[A-Z]{2}$/i) &&
      Number.isFinite(lat) &&
      Number.isFinite(lng),
  );
};

async function withLocationTimeout<T>(promise: Promise<T>, timeoutMs = 12000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("location_timeout")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export default function EditProfileScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { isDark } = useTheme();
  const { currentLanguage, isRTL } = useLanguage();
  const { scale } = useResponsive();
  const colors = useMemo(() => themeColors(isDark), [isDark]);
  const toast = useToast();
  const { requireVerified } = useEmailVerificationGuard();
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const authUser = useAuthStore((state) => state.user);
  const returnHref = useMemo(() => {
    const candidate = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    if (
      !candidate ||
      !candidate.startsWith("/") ||
      candidate.includes("://") ||
      candidate.includes("edit-profile")
    ) {
      return "/(tabs)/profile";
    }
    return candidate;
  }, [returnTo]);

  const cachedProfile = authUser?.profile || null;
  const cachedGalleryResponse = queryClient.getQueryData<GalleryResponse>(queryKeys.gallery.me);
  const cachedGallery = cachedGalleryResponse?.gallery
    || (Array.isArray(cachedProfile?.gallery) ? cachedProfile.gallery : []);
  const cachedModerationMeta = cachedProfile?.contentModeration || {};
  const cachedCompany = cleanProfileText(
    moderationCandidateForEditing(cachedModerationMeta.company) || cachedProfile?.company || "",
  );
  const [profile, setProfile] = useState<any>(cachedProfile);
  const [gallery, setGallery] = useState<GalleryItem[]>(cachedGallery);
  const [privacy, setPrivacy] = useState<GalleryPrivacy>(
    cachedGalleryResponse?.privacy
      || cachedProfile?.gallery_privacy
      || cachedProfile?.galleryPrivacy
      || "public",
  );
  const [completion, setCompletion] = useState<CompletionState>(() =>
    localCompletion(cachedProfile || {}, cachedGallery),
  );
  const [company, setCompany] = useState(cachedCompany);
  const [annualIncomeAmount, setAnnualIncomeAmount] = useState(
    cachedProfile?.annual_income?.amount
      ? formatAmount(String(cachedProfile.annual_income.amount))
      : "",
  );
  const [annualIncomeCurrency, setAnnualIncomeCurrency] = useState(
    cachedProfile?.annual_income?.currency || "USD",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const {
    data: masterdata,
    statusByType: masterdataStatus,
    retry: retryMasterdata,
    revalidate: revalidateMasterdata,
  } = useMasterdataLists(MASTER_TYPES, currentLanguage);
  const [activeSingleField, setActiveSingleField] = useState<string | null>(null);
  const [activeMultiField, setActiveMultiField] = useState<string | null>(null);
  const [companySheetOpen, setCompanySheetOpen] = useState(false);
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false);
  const [locationConfirmOpen, setLocationConfirmOpen] = useState(false);
  const [locationSettingsOpen, setLocationSettingsOpen] = useState(false);
  const [moderationWarning, setModerationWarning] = useState<TextModerationWarning | null>(null);
  const [loading, setLoading] = useState(!cachedProfile);
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [summaryDirty, setSummaryDirty] = useState(false);
  const [summaryConfirmSaving, setSummaryConfirmSaving] = useState(false);
  const [summaryDiscarding, setSummaryDiscarding] = useState(false);
  const summaryEditorRef = useRef<ProfileSummaryEditorHandle>(null);
  const initialLoadStartedRef = useRef(false);
  const hasCachedProfileRef = useRef(Boolean(cachedProfile));
  const leaveEditProfile = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(returnHref as any);
  }, [returnHref]);
  const summaryNavigation = useUnsavedNavigationGuard({
    dirty: summaryDirty,
    leaveFallback: leaveEditProfile,
  });

  const saveSummaryAndLeave = useCallback(async () => {
    if (summaryConfirmSaving) return;
    setSummaryConfirmSaving(true);
    try {
      const saved = await summaryEditorRef.current?.save();
      if (saved) summaryNavigation.leave();
      else summaryNavigation.stay();
    } finally {
      setSummaryConfirmSaving(false);
    }
  }, [summaryConfirmSaving, summaryNavigation]);

  const discardSummaryAndLeave = useCallback(() => {
    if (summaryDiscarding) return;
    setSummaryDiscarding(true);
    requestAnimationFrame(() => {
      summaryEditorRef.current?.discard();
      summaryNavigation.leave();
      setTimeout(() => setSummaryDiscarding(false), 500);
    });
  }, [summaryDiscarding, summaryNavigation]);

  const t = useCallback(
    (key: string, fallback?: string, options?: Record<string, any>) =>
      typeof translateText === "function" ? translateText(key, fallback, options) : fallback || key,
    [currentLanguage],
  );

  const fallbackText = useMemo(() => t("not_set", NOT_SET), [currentLanguage]);

  const loadCompletion = useCallback(
    async (nextProfile: any = {}, nextGallery: GalleryItem[] = []) => {
      try {
        const response = await profileService.fetchProfileCompletion();
        const data = response.completion || response.profileCompletion || response.data;
        if (data) {
          setCompletion({
            percent: Number(data.percent ?? data.percentage ?? 0),
            completed: Number(data.completed ?? 0),
            total: Number(data.total ?? 0),
            missingKeys: Array.isArray(data.missingKeys)
              ? data.missingKeys
              : Array.isArray(data.missing)
                ? data.missing
                : [],
          });
          return;
        }
      } catch {
        // The local mirror keeps the page useful if the completion endpoint is unavailable.
      }

      setCompletion(localCompletion(nextProfile || {}, nextGallery || []));
    },
    [],
  );

  const loadProfile = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await profileService.fetchMe();
      if (!response.success) throw new Error(response.message || "profile_load_failed");
      const nextProfile = response.user?.profile || response.profile;
      if (!nextProfile) throw new Error("profile_load_failed");
      const nextGallery = Array.isArray(nextProfile.gallery) ? nextProfile.gallery : [];
      setProfile(nextProfile);
      setGallery(nextGallery);
      setPrivacy(nextProfile.gallery_privacy || nextProfile.galleryPrivacy || "public");
      // The owner keeps editing their pending/rejected moderation candidate,
      // not the old approved text other users still see. Headline and bio
      // prefill lives inside ProfileSummaryEditor.
      const moderationMeta = nextProfile.contentModeration || {};
      setCompany(cleanProfileText(moderationCandidateForEditing(moderationMeta.company) || nextProfile.company || ""));
      setAnnualIncomeCurrency(nextProfile.annual_income?.currency || "USD");
      setAnnualIncomeAmount(nextProfile.annual_income?.amount ? formatAmount(String(nextProfile.annual_income.amount)) : "");
      await loadCompletion(nextProfile, nextGallery);
    } catch (error) {
      toast.show(apiMessage(String((error as any)?.message || ""), t("profile.load_error", "Could not load profile.")), "error");
    } finally {
      setLoading(false);
    }
  }, [loadCompletion]);

  useFocusEffect(
    useCallback(() => {
      revalidateMasterdata();
      const showLoader = !initialLoadStartedRef.current && !hasCachedProfileRef.current;
      initialLoadStartedRef.current = true;
      void loadProfile(showLoader);
    }, [loadProfile, revalidateMasterdata]),
  );

  const makeTranslatedOptions = useCallback(
    (values: readonly string[], namespace?: string): SelectOption[] =>
      values
        .map((value) => {
          const translated = namespace
            ? t(`${namespace}:${value}`, value.replace(/_/g, " "))
            : t(value, value.replace(/_/g, " "));
          return {
            value,
            label: formatProfileOptionLabel(translated, currentLanguage),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [currentLanguage],
  );

  const toMasterOptions = useCallback(
    (key: string): SelectOption[] =>
      (masterdata[key] || []).map((item: any) => ({
        value: item._id || item.value_id,
        label: formatProfileOptionLabel(item.label || item.name || item._id, currentLanguage),
        description: item.description,
        key: item.label || item.name,
      })),
    [currentLanguage, masterdata],
  );

  const fieldOptions = useMemo<Record<string, SelectOption[]>>(() => {
    const gender = String(profile?.gender || "").toLowerCase();
    const maritalOptions = [
      { value: "never_married", label: t("step_3.never_married", "Never married") },
      { value: "divorced", label: t("step_3.divorced", "Divorced") },
      { value: "separated", label: t("step_3.separated", "Separated") },
      { value: "widowed", label: t("step_3.widowed", "Widowed") },
      { value: "annulled", label: t("step_3.annulled", "Annulled") },
      { value: "married", label: t("step_3.married", "Married") },
    ].filter((option) => option.value !== "married" || gender === "male");
    const childrenOptions = [
      { value: "no_children", label: t("step_3.no_children", "No children") },
      { value: "has_children", label: t("step_3.has_children", "Has children") },
    ];
    const wantsChildrenOptions = [
      { value: "wants_children", label: t("step_3.wants_children", "Wants children") },
      { value: "does_not_want_children", label: t("step_3.does_not_want_children", "Does not want children") },
      { value: "open_to_have_children", label: t("step_3.open_to_have_children", "Open to have children") },
      { value: "no_preference", label: t("step_3.no_preference", "No preference") },
    ];
    const sectOptions = toMasterOptions("sect");
    const selectedSectKey = normalizeMasterKey(sectOptions.find((item) => item.value === fieldValueId(profile?.sect))?.key);
    const maslakOptionsRaw = toMasterOptions("maslak");
    const followingOptionsRaw = toMasterOptions("following");
    const sectFilters = SECT_FILTERS[selectedSectKey];

    return {
      nationality: makeTranslatedOptions(NATIONALITY_OPTIONS, "countries"),
      grew_up_in: makeTranslatedOptions(COUNTRY_OPTIONS, "countries"),
      mother_tongue: makeTranslatedOptions(LANGUAGE_OPTIONS, "languages"),
      languages_spoken: makeTranslatedOptions(LANGUAGE_OPTIONS, "languages"),
      born_muslim: [
        { value: "muslim_by_birth", label: t("step_2.muslim_by_birth", "Muslim by birth") },
        { value: "convert_revert", label: t("step_2.converted_reverted", "Convert / Revert") },
      ],
      i_usually_dress: [
        { value: "hijab", label: t("step_2.hijab", "Hijab") },
        { value: "jilbab_abaya_hijab", label: t("step_2.jilbab_abaya_hijab", "Jilbab / Abaya / Hijab") },
        { value: "hijab_niqab", label: t("step_2.hijab_niqab", "Hijab / Niqab") },
        { value: "modest_clothing", label: t("step_2.modest_clothing", "Modest clothing") },
        { value: "western_secular", label: t("step_2.western_secular", "Western / secular") },
        { value: "no_religious_dress", label: t("step_2.no_religious_dress", "No religious dress") },
      ],
      marital_status: maritalOptions,
      have_children: childrenOptions,
      wants_children: wantsChildrenOptions,
      marriage_plan: [
        { value: "as_soon_possible", label: t("step_3.as_soon_possible", "As soon as possible") },
        { value: "three_to_six_months", label: t("step_3.three_to_six_months", "3 to 6 months") },
        { value: "six_months_to_one_year", label: t("step_3.six_months_to_one_year", "6 months to 1 year") },
      ],
      relocation_plans: [
        { value: "open_to_relocate", label: t("step_3.open_to_relocate", "Open to relocate") },
        { value: "not_open_to_relocate", label: t("step_3.not_open_to_relocate", "Not open to relocate") },
        { value: "not_sure_yet", label: t("step_3.not_sure_yet", "Not sure yet") },
      ],
      height: toMasterOptions("height"),
      complexion: toMasterOptions("complexion"),
      ethnic_group: toMasterOptions("ethnic_group"),
      education: toMasterOptions("education"),
      occupation: toMasterOptions("occupation"),
      designation: toMasterOptions("designation"),
      sect: sectOptions,
      maslak: sectFilters
        ? maslakOptionsRaw.filter((item) => !item.key || sectFilters.maslak.includes(normalizeMasterKey(item.key)))
        : maslakOptionsRaw,
      following: sectFilters
        ? followingOptionsRaw.filter((item) => !item.key || sectFilters.following.includes(normalizeMasterKey(item.key)))
        : followingOptionsRaw,
      is_practising: [
        { value: "very_religious", label: t("step_6.very_religious", "Very religious") },
        { value: "religious", label: t("step_6.religious", "Religious / Practicing") },
        { value: "moderate", label: t("step_6.moderate", "Moderate") },
        { value: "liberal", label: t("step_6.liberal", "Liberal") },
        { value: "not_practicing", label: t("step_6.not_practicing", "Not practicing") },
        { value: "spiritual", label: t("step_6.spiritual", "Spiritual") },
      ],
      prayers: [
        { value: "five_times_daily", label: t("step_6.five_times_daily", "Five times daily") },
        { value: "most_prayers", label: t("step_6.most_prayers", "Most prayers") },
        { value: "some_prayers", label: t("step_6.some_prayers", "Some prayers") },
        { value: "friday_only", label: t("step_6.friday_only", "Friday only") },
        { value: "never_prays", label: t("step_6.never_prays", "Never prays") },
      ],
      smoking: [
        { value: "never_smoke", label: t("never_smoke", "Never smoke") },
        { value: "quit_smoking", label: t("quit_smoking", "Quit smoking") },
        { value: "occasionally_smokes", label: t("occasionally_smokes", "Occasionally smokes") },
        { value: "smokes_regularly", label: t("smokes_regularly", "Smokes regularly") },
        { value: "trying_to_quit", label: t("trying_to_quit", "Trying to quit") },
      ],
      alcohol: [
        { value: "never_drinks", label: t("never_drinks", "Never drinks alcohol") },
        { value: "drinks_alcohol", label: t("drinks_alcohol", "Drinks alcohol") },
        { value: "quit_alcohol", label: t("quit_alcohol", "Quit drinking") },
      ],
      profile_manager: PROFILE_MANAGER_OPTIONS.map((value) => ({ value, label: t(value, displayText(value)) })),
    };
  }, [makeTranslatedOptions, profile?.gender, profile?.sect, toMasterOptions]);

  const selectedSingleValue = useCallback((field: string) => fieldValueId(profile?.[field]), [profile]);
  const selectedMultiValue = useCallback((field: string) => fieldValueIds(profile?.[field]), [profile]);

  const incomeCurrencies = useMemo(
    () => ["USD", "EUR", "INR", "SAR", "AED", "AUD", "CAD", "QAR"],
    [],
  );

  const rows = useMemo(() => {
    const female = String(profile?.gender || "").toLowerCase() === "female";
    const annualIncome = formatIncome(profile?.annual_income, fallbackText);

    const groups: Array<{ title: string; rows: FieldRow[] }> = [
      {
        title: t("profile.location", "Location"),
        rows: [
          {
            id: "current_location",
            label: t("profile.current_location", "Current location"),
            value: formatLocation(profile?.current_location, currentLanguage, fallbackText),
            completionKey: "current_location",
            icon: MapPin,
          },
          {
            id: "nationality",
            label: t("profile.nationality", "Nationality"),
            value: formatCountryList(profile?.nationality, fallbackText),
            completionKey: "nationality",
            icon: ShieldCheck,
          },
          {
            id: "grew_up_in",
            label: t("profile.grew_up_in", "Grew up in"),
            value: countryValue(profile?.grew_up_in) || fallbackText,
            completionKey: "grew_up_in",
            icon: Home,
            locked: true,
          },
        ],
      },
      {
        title: t("profile.personal_background", "Personal and cultural background"),
        rows: [
          {
            id: "mother_tongue",
            label: t("profile.mother_tongue", "Mother tongue"),
            value: formatSelect(profile?.mother_tongue, fallbackText),
            completionKey: "mother_tongue",
            icon: Mic,
          },
          {
            id: "languages_spoken",
            label: t("profile.languages_spoken", "Languages spoken"),
            value: formatList(profile?.languages_spoken, fallbackText),
            completionKey: "languages_spoken",
            icon: Languages,
          },
          {
            id: "born_muslim",
            label: t("profile.born_muslim", "Born Muslim"),
            value: formatSelect(profile?.born_muslim, fallbackText),
            completionKey: "born_muslim",
            icon: ShieldCheck,
          },
          ...(female
            ? [
                {
                  id: "i_usually_dress",
                  label: t("profile.i_usually_dress", "How do you usually dress?"),
                  value: formatSelect(profile?.i_usually_dress, fallbackText),
                  completionKey: "i_usually_dress",
                  icon: Shirt,
                } satisfies FieldRow,
              ]
            : []),
        ],
      },
      {
        title: t("profile.appearance", "Appearance"),
        rows: [
          {
            id: "height",
            label: t("profile.height", "Height"),
            value: formatSelect(profile?.height, fallbackText),
            completionKey: "height",
            icon: Ruler,
          },
          {
            id: "complexion",
            label: t("profile.complexion", "Complexion"),
            value: formatSelect(profile?.complexion, fallbackText),
            completionKey: "complexion",
            icon: UserRound,
          },
          {
            id: "ethnic_group",
            label: t("profile.ethnic_group", "Ethnic group"),
            value: formatSelect(profile?.ethnic_group, fallbackText),
            completionKey: "ethnic_group",
            icon: Users,
          },
        ],
      },
      {
        title: t("profile.relationship_status", "Relationship status"),
        rows: [
          {
            id: "marital_status",
            label: t("profile.marital_status", "Marital status"),
            value: formatSelect(profile?.marital_status, fallbackText),
            completionKey: "marital_status",
            icon: Users,
          },
          {
            id: "have_children",
            label: t("profile.have_children", "Have children"),
            value: formatSelect(profile?.have_children, fallbackText),
            completionKey: "have_children",
            icon: Baby,
          },
          {
            id: "wants_children",
            label: t("profile.wants_children", "Wants children"),
            value: formatSelect(profile?.wants_children, fallbackText),
            completionKey: "wants_children",
            icon: Baby,
          },
        ],
      },
      {
        title: t("profile.future_plans", "Future plans"),
        rows: [
          {
            id: "marriage_plan",
            label: t("profile.marriage_plan", "Marriage plan"),
            value: formatSelect(profile?.marriage_plan, fallbackText),
            completionKey: "marriage_plan",
            icon: CalendarHeart,
          },
          {
            id: "relocation_plans",
            label: t("profile.relocation_plans", "Relocation plans"),
            value: formatSelect(profile?.relocation_plans, fallbackText),
            completionKey: "relocation_plans",
            icon: Plane,
          },
        ],
      },
      {
        title: t("profile.professional_info", "Professional info"),
        rows: [
          {
            id: "education",
            label: t("profile.education", "Education"),
            value: formatSelect(profile?.education, fallbackText),
            completionKey: "education",
            icon: GraduationCap,
          },
          {
            id: "occupation",
            label: t("profile.occupation", "Occupation"),
            value: formatSelect(profile?.occupation, fallbackText),
            completionKey: "occupation",
            icon: BriefcaseBusiness,
          },
          {
            id: "designation",
            label: t("profile.designation", "Designation"),
            value: formatSelect(profile?.designation, fallbackText),
            icon: BriefcaseBusiness,
          },
          {
            id: "company",
            label: t("profile.company", "Company"),
            value: company || fallbackText,
            completionKey: "company",
            icon: Building2,
            pendingReview: Boolean(pendingModerationCandidate(profile?.contentModeration?.company)),
          },
          {
            id: "annual_income",
            label: t("profile.annual_income", "Annual income"),
            value: annualIncome,
            completionKey: "annual_income",
            icon: Coins,
          },
        ],
      },
      {
        title: t("profile.religious_beliefs", "Religious beliefs"),
        rows: [
          {
            id: "sect",
            label: t("profile.sect", "Sect"),
            value: formatSelect(profile?.sect, fallbackText),
            completionKey: "sect",
            icon: Moon,
          },
          {
            id: "maslak",
            label: t("profile.maslak", "Maslak / School of thought"),
            value: formatSelect(profile?.maslak, fallbackText),
            completionKey: "maslak",
            icon: Sparkles,
          },
          {
            id: "following",
            label: t("profile.following", "Following / Movement"),
            value: formatSelect(profile?.following, fallbackText),
            icon: Heart,
          },
          {
            id: "is_practising",
            label: t("profile.is_practising", "How practising are you?"),
            value: formatSelect(profile?.is_practising, fallbackText),
            completionKey: "is_practising",
            icon: Moon,
          },
          {
            id: "prayers",
            label: t("profile.prayers", "Prayer habit"),
            value: formatSelect(profile?.prayers, fallbackText),
            completionKey: "prayers",
            icon: CalendarHeart,
          },
        ],
      },
      {
        title: t("profile.lifestyle", "Lifestyle"),
        rows: [
          {
            id: "smoking",
            label: t("profile.smoking", "Smoking"),
            value: formatSelect(profile?.smoking, fallbackText),
            completionKey: "smoking",
            icon: Cigarette,
          },
          {
            id: "alcohol",
            label: t("profile.alcohol", "Alcohol"),
            value: formatSelect(profile?.alcohol, fallbackText),
            completionKey: "alcohol",
            icon: Wine,
          },
        ],
      },
      {
        title: t("profile_manager", "Profile manager"),
        rows: [
          {
            id: "profile_manager",
            label: t("profile_manager", "Profile manager"),
            value: profile?.profile_manager
              ? t(String(profile.profile_manager), displayText(String(profile.profile_manager)))
              : fallbackText,
            completionKey: "profile_manager",
            icon: UserCog,
          },
        ],
      },
    ];

    return groups;
  }, [company, currentLanguage, fallbackText, profile]);

  // Weighted "+N%" badges: each missing group's share of (100 - percent),
  // summing exactly to the remainder (largest-remainder rounding, web parity)
  const impactGroups = useMemo(() => buildMissingImpactGroups(rows), [rows]);
  const missingImpacts = useMemo(
    () => calculateWeightedMissingImpacts(completion.percent, completion.missingKeys, impactGroups),
    [completion.missingKeys, completion.percent, impactGroups],
  );
  const missingKeySet = useMemo(() => new Set(completion.missingKeys), [completion.missingKeys]);
  const mediaMissing = missingKeySet.has("avatar") || missingKeySet.has("gallery");
  const summaryMissing = missingKeySet.has("profile_headline") || missingKeySet.has("bio");
  const hobbiesMissing = missingKeySet.has("hobbies");

  // Web parity: sections containing missing fields are promoted directly
  // below the gallery; the rest keep the canonical order
  const { promotedSections, regularSections } = useMemo(() => {
    const promoted: typeof rows = [];
    const regular: typeof rows = [];
    for (const section of rows) {
      const hasMissing = section.rows.some(
        (row) => row.completionKey && missingKeySet.has(row.completionKey),
      );
      (hasMissing ? promoted : regular).push(section);
    }
    return { promotedSections: promoted, regularSections: regular };
  }, [missingKeySet, rows]);

  const rowById = useMemo(() => {
    const map = new Map<string, FieldRow>();
    rows.forEach((section) => section.rows.forEach((row) => map.set(row.id, row)));
    return map;
  }, [rows]);

  const activeSingleOptions = activeSingleField ? fieldOptions[activeSingleField] || [] : [];
  const activeMultiOptions: MultiSelectOption[] = activeMultiField ? fieldOptions[activeMultiField] || [] : [];
  const activeSingleTitle = activeSingleField ? rowById.get(activeSingleField)?.label || "" : "";
  const activeMultiTitle = activeMultiField ? rowById.get(activeMultiField)?.label || "" : "";
  const activeMultiMax = activeMultiField === "nationality" || activeMultiField === "ethnic_group" ? 2 : 5;
  const activeSingleMasterType = activeSingleField && MASTER_FIELDS.has(activeSingleField) ? activeSingleField : null;
  const activeMultiMasterType = activeMultiField && MASTER_FIELDS.has(activeMultiField) ? activeMultiField : null;

  const onGalleryChange = useCallback(
    (payload: { gallery: GalleryItem[]; privacy: GalleryPrivacy; avatarUuid?: string | null }) => {
      const nextGallery = payload.gallery;
      const nextPrivacy = payload.privacy;
      setGallery(nextGallery);
      setPrivacy(nextPrivacy);
      setProfile((current: any) => ({
        ...(current || {}),
        gallery: nextGallery,
        gallery_privacy: nextPrivacy,
        avatar: nextGallery.find((item) => item.isPrimary) || nextGallery[0] || current?.avatar,
      }));
      void loadCompletion(profile, nextGallery);
    },
    [loadCompletion, profile],
  );

  // Last submitted company draft, so the moderation modal's "Submit anyway"
  // can resend the exact text that was rejected
  const [companyDraft, setCompanyDraft] = useState("");

  const saveCompany = (value: string, submitAnyway = false) => {
    if (!requireVerified("save")) return;
    void (async () => {
      const cleaned = cleanHeadlineTextForSave(value);
      const companyError =
        cleaned && (!isAllowedProfileText(cleaned) || countNonSpace(cleaned) > COMPANY_MAX)
          ? t("profile.invalid_company", "Use a shorter company name without links or unsupported characters.")
          : "";
      setErrors((current) => ({ ...current, company: companyError }));
      if (companyError) return;

      setCompanyDraft(value);
      setSaving(true);
      try {
        const response = await profileService.updateProfile({
          company: cleaned,
          clientLocale: currentLanguage,
          ...(submitAnyway ? { submitAnyway: true } : {}),
        });
        if (response.success === false) {
          const warning = getTextModerationWarning(response);
          if (warning) {
            const rejection = extractModerationRejection(response);
            if (rejection) setErrors((current) => ({ ...current, ...rejection.fieldErrors }));
            setModerationWarning(warning);
          } else {
            toast.show(apiMessage(String(response.message || ""), t("profile.update_error", "Could not update profile.")), "error");
          }
          return;
        }
        setModerationWarning(null);
        setCompany(cleaned);
        setCompanySheetOpen(false);
        const nextProfile = response.profile || response.user?.profile || { ...(profile || {}), company: cleaned };
        setProfile(nextProfile);
        await refreshUser();
        const savedForReview = Boolean(
          pendingModerationCandidate(
            useAuthStore.getState().user?.profile?.contentModeration?.company,
          ),
        );
        await loadCompletion(nextProfile, gallery);
        toast.show(
          submitAnyway || savedForReview
            ? t("moderation_submit_anyway_success", "Submitted for review.")
            : t("profile.profile_updated", "Profile updated."),
          "success",
        );
      } catch (error) {
        toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
      } finally {
        setSaving(false);
      }
    })();
  };

  const saveIncome = (currency: string, amount: string) => {
    if (!requireVerified("save")) return;
    void (async () => {
      const parsed = parseAmount(amount);
      const incomeError =
        !amount.trim() || !Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_INCOME
          ? t("annual_income_invalid", "Please enter a valid annual income amount.")
          : "";
      setErrors((current) => ({ ...current, annualIncome: incomeError }));
      if (incomeError) return;

      setSaving(true);
      try {
        const payload = { annual_income: { currency, amount: parsed } };
        const response = await profileService.updateProfile(payload);
        await mergeUpdatedProfile(payload, response.profile || response.user?.profile);
        setAnnualIncomeCurrency(currency);
        setAnnualIncomeAmount(formatAmount(String(parsed)));
        setIncomeSheetOpen(false);
        toast.show(t("profile.profile_updated", "Profile updated."), "success");
      } catch (error) {
        toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
      } finally {
        setSaving(false);
      }
    })();
  };

  const moderationMeta = profile?.contentModeration || {};
  const companyPending = Boolean(pendingModerationCandidate(moderationMeta.company));

  const mergeUpdatedProfile = useCallback(
    async (payload: Record<string, any>, responseProfile?: any) => {
      const nextProfile = responseProfile || { ...(profile || {}), ...payload };
      setProfile(nextProfile);
      await refreshUser();
      await loadCompletion(nextProfile, gallery);
    },
    [gallery, loadCompletion, profile, refreshUser],
  );

  const saveFieldPayload = useCallback(
    async (field: string, payload: Record<string, any>) => {
      if (!requireVerified("save")) return false;
      setSavingField(field);
      try {
        const response = await profileService.updateProfile(payload);
        await mergeUpdatedProfile(payload, response.profile || response.user?.profile);
        toast.show(t("profile.profile_updated", "Profile updated."), "success");
        return true;
      } catch (error) {
        toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
        return false;
      } finally {
        setSavingField(null);
      }
    },
    [mergeUpdatedProfile, requireVerified, toast],
  );

  const buildLocalMasterValue = useCallback(
    (field: string, valueId: string) => {
      const option = fieldOptions[field]?.find((item) => item.value === valueId);
      return { value_id: valueId, label: option?.key || option?.label || valueId };
    },
    [fieldOptions],
  );

  const handleSingleSelect = useCallback(
    (field: string, value: string) => {
      const payload: Record<string, any> = MASTER_FIELDS.has(field)
        ? { [field]: { value_id: value } }
        : { [field]: value };

      if (field === "sect") {
        payload.maslak = "";
        payload.following = "";
      }

      const localPayload: Record<string, any> = MASTER_FIELDS.has(field)
        ? { [field]: buildLocalMasterValue(field, value) }
        : { [field]: value };

      if (field === "sect") {
        localPayload.maslak = "";
        localPayload.following = "";
      }

      void saveFieldPayload(field, payload).then((saved) => {
        if (saved) setProfile((current: any) => ({ ...(current || {}), ...localPayload }));
      });
    },
    [buildLocalMasterValue, saveFieldPayload],
  );

  const handleMultiSelect = useCallback(
    (field: string, values: string[]) => {
      const payload = MASTER_FIELDS.has(field)
        ? { [field]: values.map((value) => ({ value_id: value })) }
        : { [field]: values };
      const localPayload = MASTER_FIELDS.has(field)
        ? { [field]: values.map((value) => buildLocalMasterValue(field, value)) }
        : { [field]: values };

      void saveFieldPayload(field, payload).then((saved) => {
        if (saved) setProfile((current: any) => ({ ...(current || {}), ...localPayload }));
      });
    },
    [buildLocalMasterValue, saveFieldPayload],
  );

  const refreshCurrentLocation = useCallback(async () => {
    if (!requireVerified("save")) return;

    setSavingField("current_location");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationSettingsOpen(true);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        toast.show(
          t("device_location_services_disabled", "Please turn on device location services and try again."),
          "error",
        );
        return;
      }

      let position: Location.LocationObject | null = null;
      try {
        position = await withLocationTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        );
      } catch {
        position = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 5000,
        });
      }

      if (!position) {
        toast.show(
          t("device_location_unavailable", "Could not get your device location. Please enable location services and try again."),
          "error",
        );
        return;
      }

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const reverseResponse = await profileService.fetchPlaceReverse(lat, lng, "en");

      if (!reverseResponse.success || !hasResolvedLocation(reverseResponse.data)) {
        const messageKey =
          reverseResponse.message === "network_error"
            ? "location_backend_network_error"
            : reverseResponse.status === 404 || reverseResponse.message === "invalid_json"
              ? "location_backend_unavailable"
              : "location_resolve_failed";
        toast.show(
          t(messageKey, "Could not resolve your city from this location. Please try again."),
          "error",
        );
        return;
      }

      const details = reverseResponse.data as PlaceDetails;
      const payload = {
        current_location: {
          place_id: details.place_id,
          country: String(details.countryCode || "").toUpperCase(),
          ...(details.state ? { state: details.state.trim() } : {}),
          city: String(details.city || "").trim(),
          geo: {
            type: "Point",
            coordinates: [Number(details.lng), Number(details.lat)],
          },
        },
      };

      const response = await profileService.updateProfile(payload);
      await mergeUpdatedProfile(payload, response.profile || response.user?.profile);
      toast.show(t("profile.profile_updated", "Profile updated."), "success");
    } catch (error) {
      toast.show(apiMessage(String((error as any)?.message || ""), t("profile.update_error", "Could not update profile.")), "error");
    } finally {
      setSavingField(null);
    }
  }, [mergeUpdatedProfile, requireVerified, toast]);

  const openFieldEditor = (row: FieldRow) => {
    if (row.locked) {
      toast.show(t("cannot_change", "Cannot be changed"), "info");
      return;
    }

    if (row.id === "current_location") {
      setLocationConfirmOpen(true);
      return;
    }

    if (row.id === "company") {
      setCompanySheetOpen(true);
      return;
    }

    if (row.id === "annual_income") {
      setIncomeSheetOpen(true);
      return;
    }

    if (["nationality", "languages_spoken", "ethnic_group"].includes(row.id)) {
      setActiveMultiField(row.id);
      return;
    }

    setActiveSingleField(row.id);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const renderFieldSection = (section: { title: string; rows: FieldRow[] }) => (
    <View
      key={section.title}
      style={[styles.sectionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
    >
      <Text
        variant="caption"
        className="font-body-semi"
        style={[styles.sectionTitle, { color: colors.muted, fontSize: scale(13) }]}
      >
        {section.title}
      </Text>
      {section.rows.map((row, index) => {
        const Icon = row.icon;
        const missing = row.completionKey ? missingKeySet.has(row.completionKey) : false;
        const impact = missing && row.completionKey ? missingImpacts[row.completionKey] || 0 : 0;
        const notSet = row.value === fallbackText;

        return (
          // Pressable is only a shell: on this build a Pressable with
          // function/array styles can drop its layout styles, stacking the
          // row into a column — layout lives on the inner plain View
          <Pressable
            key={row.id}
            onPress={() => openFieldEditor(row)}
            disabled={Boolean(savingField)}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}, ${row.value}`}
            accessibilityHint={impact ? `+${impact}%` : undefined}
            accessibilityState={row.locked ? { disabled: true } : undefined}
            style={({ pressed }) => (pressed && !row.locked ? { opacity: 0.82 } : null)}
          >
            <View
              style={[
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                missing && { backgroundColor: "rgba(243,75,111,0.07)" },
              ]}
            >
              <View
                style={[
                  styles.iconTile,
                  missing
                    ? { backgroundColor: "rgba(243,75,111,0.12)" }
                    : {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(24,19,14,0.06)",
                      },
                ]}
              >
                <Icon size={19} color={missing ? colors.primary : colors.muted} strokeWidth={2} />
              </View>
              <View style={styles.rowContent}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowLabel, { color: colors.muted }]}>{row.label}</Text>
                  {row.locked ? <Lock size={12} color={colors.muted} /> : null}
                  {row.pendingReview ? <UnderReviewPill interactive={false} /> : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.rowValue,
                    { color: missing ? colors.primary : notSet ? colors.muted : colors.text },
                    notSet && !missing && styles.rowValueNotSet,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
              {impact ? <ImpactBadge value={impact} /> : null}
              {savingField === row.id ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : row.locked ? null : (
                isRTL ? (
                  <ChevronLeft size={19} color={colors.muted} style={styles.rowChevron} />
                ) : (
                  <ChevronRight size={19} color={colors.muted} style={styles.rowChevron} />
                )
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const renderChipSection = (config: {
    key: string;
    title: string;
    items: any[];
    type: "hobby" | "faith";
    emptyLabel: string;
    impact: number;
  }) => {
    const chips = config.items.map((item) => emojiChipItem(item, config.type)).filter((item) => item.label);
    const SectionIcon = config.type === "hobby" ? Puzzle : BookHeart;
    return (
      // Pressable shell only — layout on the inner View (see field rows)
      <Pressable
        key={config.key}
        onPress={() => router.push({
          pathname: "/(tabs)/hobbies-faith",
          params: {
            section: config.type === "hobby" ? "hobbies" : "faith",
            returnTo: "/(tabs)/edit-profile",
          },
        })}
        accessibilityRole="button"
        accessibilityLabel={config.title}
        accessibilityHint={config.impact ? `+${config.impact}%` : undefined}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <View
          style={[
            styles.sectionCard,
            { borderColor: config.impact ? colors.primary : colors.border, backgroundColor: colors.background },
          ]}
        >
        <View style={styles.chipHeaderRow}>
          <SectionIcon
            size={19}
            color={config.impact ? colors.primary : colors.muted}
            strokeWidth={2}
          />
          <Text
            variant="caption"
            className="font-body-semi"
            style={[styles.sectionTitle, styles.chipHeaderTitle, { color: colors.muted, fontSize: scale(13) }]}
          >
            {config.title}
          </Text>
          {config.impact ? <ImpactBadge value={config.impact} /> : null}
          {isRTL ? (
            <ChevronLeft size={19} color={colors.muted} style={styles.rowChevron} />
          ) : (
            <ChevronRight size={19} color={colors.muted} style={styles.rowChevron} />
          )}
        </View>
        {chips.length ? (
          <View style={styles.chipWrap}>
            {chips.map((item, index) => (
              <View
                key={`${config.key}-${item.slug}-${index}`}
                style={[styles.chip, { backgroundColor: colors.surface }]}
              >
                <Text style={styles.chipEmoji}>{item.emoji}</Text>
                <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.chipEmpty, { color: config.impact ? colors.primary : colors.muted }]}>
            {config.emptyLabel}
          </Text>
        )}
        </View>
      </Pressable>
    );
  };

  const summaryCard = (
    <View style={[styles.sectionCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
      <Text
        variant="caption"
        className="font-body-semi"
        style={[styles.sectionTitle, { color: colors.muted, fontSize: scale(13) }]}
      >
        {t("profile.profile_summary", "Profile summary")}
      </Text>
      <View style={styles.summaryContent}>
        <ProfileSummaryEditor
          ref={summaryEditorRef}
          profile={profile}
          onSaved={loadProfile}
          onDirtyChange={setSummaryDirty}
          headlineImpact={missingKeySet.has("profile_headline") ? missingImpacts.profile_headline || 0 : 0}
          bioImpact={missingKeySet.has("bio") ? missingImpacts.bio || 0 : 0}
        />
      </View>
    </View>
  );

  const hobbiesSection = renderChipSection({
    key: "hobbies",
    title: t("hobbies", "Hobbies"),
    items: Array.isArray(profile?.hobbies) ? profile.hobbies : [],
    type: "hobby",
    emptyLabel: t("click_add_hobbies", "Tap to add your hobbies"),
    impact: hobbiesMissing ? missingImpacts.hobbies || 0 : 0,
  });

  const faithSection = renderChipSection({
    key: "faith",
    title: t("faith_in_daily_life", "Faith in Daily Life"),
    items: Array.isArray(profile?.faith_in_daily_life) ? profile.faith_in_daily_life : [],
    type: "faith",
    emptyLabel: t("click_add_faith", "Tap to add how faith shapes your daily life"),
    // Faith is not part of profile completion today; if the backend ever adds
    // it to missingKeys the badge appears automatically
    impact: missingKeySet.has("faith_in_daily_life") ? missingImpacts.faith_in_daily_life || 0 : 0,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBackTitleBar
        title={t("edit_profile", "Edit profile")}
        fallbackHref="/(tabs)/profile"
        onBack={summaryNavigation.requestClose}
      />
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={scale(24)}
      >
        <ProfileCompletionBar percent={completion.percent} />

        <View
          style={
            mediaMissing
              ? [styles.mediaMissingWrap, { borderColor: colors.primary }]
              : null
          }
        >
          <EditProfileMediaEditor
            canUsePrivateGallery={String(profile?.gender || "").toLowerCase() === "female"}
            gender={String(profile?.gender || "").toLowerCase() === "female" ? "female" : "male"}
            guidelinesIdentity={String(authUser?._id || authUser?.email || "current-user")}
            initialGallery={gallery}
            initialPrivacy={privacy}
            completionImpact={mediaMissing ? missingImpacts.media || 0 : 0}
            onGalleryChange={onGalleryChange}
          />
        </View>

        {/* Web parity: whatever is missing gets promoted right below the photos */}
        {summaryMissing ? summaryCard : null}
        {hobbiesMissing ? hobbiesSection : null}
        {promotedSections.map(renderFieldSection)}
        {!summaryMissing ? summaryCard : null}
        {regularSections.map(renderFieldSection)}
        {faithSection}
        {!hobbiesMissing ? hobbiesSection : null}

        <View style={{ height: 24 }} />
      </KeyboardAwareScrollView>

      <TextModerationWarningModal
        warning={moderationWarning}
        submitting={saving}
        onEdit={() => setModerationWarning(null)}
        onClose={() => setModerationWarning(null)}
        onSubmitAnyway={() => saveCompany(companyDraft, true)}
      />

      <SingleSelectSheet
        visible={Boolean(activeSingleField)}
        onClose={() => setActiveSingleField(null)}
        onSelect={(value) => {
          if (activeSingleField) handleSingleSelect(activeSingleField, value);
        }}
        options={activeSingleOptions}
        selected={activeSingleField ? selectedSingleValue(activeSingleField) : undefined}
        title={activeSingleTitle}
        searchEnabled={activeSingleOptions.length > 8}
        loading={Boolean(activeSingleMasterType && masterdataStatus[activeSingleMasterType] === "loading")}
        error={Boolean(activeSingleMasterType && masterdataStatus[activeSingleMasterType] === "error")}
        onRetry={activeSingleMasterType ? () => retryMasterdata(activeSingleMasterType) : undefined}
      />

      <MultiSelectSheet
        visible={Boolean(activeMultiField)}
        onClose={() => setActiveMultiField(null)}
        onConfirm={(values) => {
          if (activeMultiField) handleMultiSelect(activeMultiField, values);
        }}
        options={activeMultiOptions}
        selected={activeMultiField ? selectedMultiValue(activeMultiField) : []}
        title={activeMultiTitle}
        maxSelections={activeMultiMax}
        searchEnabled
        loading={Boolean(activeMultiMasterType && masterdataStatus[activeMultiMasterType] === "loading")}
        error={Boolean(activeMultiMasterType && masterdataStatus[activeMultiMasterType] === "error")}
        onRetry={activeMultiMasterType ? () => retryMasterdata(activeMultiMasterType) : undefined}
      />

      <TextEditSheet
        visible={companySheetOpen}
        title={t("profile.company", "Company")}
        initialValue={company}
        placeholder={t("profile.company", "Company")}
        maxNonSpace={COMPANY_MAX}
        saving={saving}
        pendingReview={companyPending}
        errorText={errors.company || undefined}
        onClose={() => {
          if (saving) return;
          setCompanySheetOpen(false);
          setErrors((current) => ({ ...current, company: "" }));
        }}
        onSave={(value) => saveCompany(value)}
      />

      <IncomeEditSheet
        visible={incomeSheetOpen}
        title={t("profile.annual_income", "Annual income")}
        initialCurrency={annualIncomeCurrency}
        initialAmount={annualIncomeAmount}
        currencies={incomeCurrencies}
        saving={saving}
        errorText={errors.annualIncome || undefined}
        onClose={() => {
          if (saving) return;
          setIncomeSheetOpen(false);
          setErrors((current) => ({ ...current, annualIncome: "" }));
        }}
        onSave={saveIncome}
      />

      <ConfirmSheet
        visible={locationConfirmOpen}
        onClose={() => setLocationConfirmOpen(false)}
        onConfirm={() => {
          setLocationConfirmOpen(false);
          void refreshCurrentLocation();
        }}
        title={t("profile.current_location", "Current location")}
        message={t(
          "profile.location_edit_from_device",
          "Location editing will use your device location. We will open this as a dedicated edit screen.",
        )}
        confirmLabel={t("continue", "Continue")}
        cancelLabel={t("cancel", "Cancel")}
      />

      <ConfirmSheet
        visible={locationSettingsOpen}
        onClose={() => setLocationSettingsOpen(false)}
        onConfirm={() => {
          setLocationSettingsOpen(false);
          void Linking.openSettings().catch(() => {
            toast.show(
              t("something_went_wrong", "Could not open app settings."),
              "error",
            );
          });
        }}
        title={t("app_settings", "App Settings")}
        message={t(
          "location_permission_required",
          "Location permission is required to update your current city.",
        )}
        confirmLabel={t("open_settings", "Open Settings")}
        cancelLabel={t("cancel", "Cancel")}
      />

      <ConfirmSheet
        visible={summaryNavigation.confirmationVisible}
        onClose={summaryNavigation.stay}
        onCancel={discardSummaryAndLeave}
        onConfirm={() => void saveSummaryAndLeave()}
        title={t("unsaved_changes_title", "Unsaved changes")}
        message={t("unsaved_changes_message", "Save your changes before leaving?")}
        confirmLabel={t("save", "Save")}
        cancelLabel={t("discard", "Discard")}
        confirmLoading={summaryConfirmSaving}
        cancelLoading={summaryDiscarding}
      />
    </View>
  );
}

function ImpactBadge({ value }: { value: number }) {
  return (
    <View style={styles.impactBadge} accessibilityLabel={`+${value}%`}>
      <Text style={styles.impactBadgeText}>{`\u2066+${value}%\u2069`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  container: {
    paddingBottom: 112,
    paddingTop: 0,
  },
  // Full-width profile bands mirror My Profile while controls remain framed.
  sectionCard: {
    borderTopWidth: 1,
    borderRadius: 0,
    marginTop: 0,
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: "uppercase",
  },
  summaryContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
  },
  // Neutral rounded-square tile; brand tint only when the field is missing
  iconTile: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    flexShrink: 0,
    width: 40,
  },
  rowChevron: {
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTop: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: Typography.font.body.bold,
    fontWeight: "700",
    letterSpacing: 1.5,
    lineHeight: 17,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  rowValue: {
    fontSize: 15,
    fontFamily: Typography.font.body.semi,
    fontWeight: "600",
    lineHeight: 21,
  },
  rowValueNotSet: {
    opacity: 0.55,
  },
  impactBadge: {
    backgroundColor: PRIMARY,
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  impactBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: Typography.font.body.bold,
    fontWeight: "700",
    writingDirection: "ltr",
  },
  mediaMissingWrap: {
    borderRadius: 0,
    marginTop: 0,
  },
  chipHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
  },
  chipHeaderTitle: {
    flex: 1,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chip: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  chipLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: Typography.font.body.medium,
    fontWeight: "500",
  },
  chipEmpty: {
    fontSize: 14,
    fontFamily: Typography.font.body.semi,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
