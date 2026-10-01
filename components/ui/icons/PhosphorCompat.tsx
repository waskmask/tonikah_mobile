import React from 'react';
import {
    AirplaneTilt,
    AppleLogo,
    Archive as PhosphorArchive,
    ArrowBendUpLeft,
    ArrowClockwise,
    ArrowUUpLeft,
    Baby as PhosphorBaby,
    Bell as PhosphorBell,
    BellSlash,
    BookOpen as PhosphorBookOpen,
    BookOpenText,
    BookmarkSimple,
    Briefcase as PhosphorBriefcase,
    Buildings,
    CalendarDots,
    CalendarHeart as PhosphorCalendarHeart,
    Camera as PhosphorCamera,
    CaretDown,
    CaretLeft,
    CaretRight,
    ChatCircle,
    Check as PhosphorCheck,
    CheckCircle,
    Checks,
    Cigarette as PhosphorCigarette,
    Clock,
    ClockCounterClockwise,
    Compass as PhosphorCompass,
    Copy as PhosphorCopy,
    CreditCard as PhosphorCreditCard,
    Crosshair,
    Desktop,
    DeviceMobile,
    DotsThreeVertical,
    Download as PhosphorDownload,
    EyeSlash,
    FileLock,
    Flag as PhosphorFlag,
    Footprints as PhosphorFootprints,
    GenderIntersex,
    Gift as PhosphorGift,
    GraduationCap as PhosphorGraduationCap,
    Image as PhosphorImage,
    ImagesSquare,
    Info as PhosphorInfo,
    Key,
    Keyboard as PhosphorKeyboard,
    Lifebuoy,
    List,
    Lock as PhosphorLock,
    LockOpen,
    MagnifyingGlass,
    MapPin as PhosphorMapPin,
    Megaphone as PhosphorMegaphone,
    Microphone,
    Money,
    Moon as PhosphorMoon,
    MoonStars,
    Palette as PhosphorPalette,
    PaperPlaneTilt,
    Pause as PhosphorPause,
    PencilSimple,
    PencilSimpleLine,
    Play as PhosphorPlay,
    Prohibit,
    PuzzlePiece,
    Quotes,
    Ruler as PhosphorRuler,
    ShieldCheck as PhosphorShieldCheck,
    ShieldWarning,
    ShoppingBag as PhosphorShoppingBag,
    SignOut,
    Signpost as PhosphorSignpost,
    Sparkle,
    Star as PhosphorStar,
    Stop,
    Sun as PhosphorSun,
    Trash,
    Translate,
    TShirt,
    User as PhosphorUser,
    UserGear,
    UserMinus,
    UserPlus,
    Users as PhosphorUsers,
    Warning,
    WarningCircle,
    WifiSlash,
    Wine as PhosphorWine,
    X as PhosphorX,
    XCircle as PhosphorXCircle,
    type Icon,
    type IconProps,
    type IconWeight,
} from 'phosphor-react-native';

type CompatIconProps = IconProps & {
    strokeWidth?: number;
    absoluteStrokeWidth?: boolean;
    fill?: string;
    fillOpacity?: number;
    [key: string]: any;
};

function inferredWeight(strokeWidth?: number, fill?: string): IconWeight {
    if (fill && fill !== 'none' && fill !== 'transparent') return 'fill';
    if (typeof strokeWidth === 'number' && strokeWidth >= 2.5) return 'bold';
    if (typeof strokeWidth === 'number' && strokeWidth <= 1.5) return 'light';
    return 'regular';
}

function phosphorCompat(IconComponent: Icon, displayName: string) {
    const CompatIcon = ({
        strokeWidth,
        absoluteStrokeWidth: _absoluteStrokeWidth,
        fill,
        fillOpacity: _fillOpacity,
        weight,
        color,
        ...props
    }: CompatIconProps) => (
        <IconComponent
            {...props}
            color={color || (fill && fill !== 'none' ? fill : undefined)}
            weight={weight || inferredWeight(strokeWidth, fill)}
        />
    );
    CompatIcon.displayName = displayName;
    return CompatIcon;
}

export const AlertCircle = phosphorCompat(WarningCircle, 'AlertCircle');
export const Apple = phosphorCompat(AppleLogo, 'Apple');
export const Archive = phosphorCompat(PhosphorArchive, 'Archive');
export const Baby = phosphorCompat(PhosphorBaby, 'Baby');
export const Ban = phosphorCompat(Prohibit, 'Ban');
export const Banknote = phosphorCompat(Money, 'Banknote');
export const Bell = phosphorCompat(PhosphorBell, 'Bell');
export const BellOff = phosphorCompat(BellSlash, 'BellOff');
export const BookHeart = phosphorCompat(BookOpenText, 'BookHeart');
export const Bookmark = phosphorCompat(BookmarkSimple, 'Bookmark');
export const BookOpen = phosphorCompat(PhosphorBookOpen, 'BookOpen');
export const Briefcase = phosphorCompat(PhosphorBriefcase, 'Briefcase');
export const BriefcaseBusiness = phosphorCompat(PhosphorBriefcase, 'BriefcaseBusiness');
export const Building2 = phosphorCompat(Buildings, 'Building2');
export const CalendarDays = phosphorCompat(CalendarDots, 'CalendarDays');
export const CalendarHeart = phosphorCompat(PhosphorCalendarHeart, 'CalendarHeart');
export const Camera = phosphorCompat(PhosphorCamera, 'Camera');
export const Check = phosphorCompat(PhosphorCheck, 'Check');
export const CheckCheck = phosphorCompat(Checks, 'CheckCheck');
export const CheckCircle2 = phosphorCompat(CheckCircle, 'CheckCircle2');
export const ChevronDown = phosphorCompat(CaretDown, 'ChevronDown');
export const ChevronLeft = phosphorCompat(CaretLeft, 'ChevronLeft');
export const ChevronRight = phosphorCompat(CaretRight, 'ChevronRight');
export const Cigarette = phosphorCompat(PhosphorCigarette, 'Cigarette');
export const CircleAlert = phosphorCompat(WarningCircle, 'CircleAlert');
export const Clock3 = phosphorCompat(Clock, 'Clock3');
export const Compass = phosphorCompat(PhosphorCompass, 'Compass');
export const Copy = phosphorCompat(PhosphorCopy, 'Copy');
export const CreditCard = phosphorCompat(PhosphorCreditCard, 'CreditCard');
export const Download = phosphorCompat(PhosphorDownload, 'Download');
export const EyeOff = phosphorCompat(EyeSlash, 'EyeOff');
export const FileLock2 = phosphorCompat(FileLock, 'FileLock2');
export const Flag = phosphorCompat(PhosphorFlag, 'Flag');
export const Footprints = phosphorCompat(PhosphorFootprints, 'Footprints');
export const Gift = phosphorCompat(PhosphorGift, 'Gift');
export const GraduationCap = phosphorCompat(PhosphorGraduationCap, 'GraduationCap');
export const History = phosphorCompat(ClockCounterClockwise, 'History');
export const Image = phosphorCompat(PhosphorImage, 'Image');
export const ImagePlus = phosphorCompat(ImagesSquare, 'ImagePlus');
export const Info = phosphorCompat(PhosphorInfo, 'Info');
export const Keyboard = phosphorCompat(PhosphorKeyboard, 'Keyboard');
export const KeyRound = phosphorCompat(Key, 'KeyRound');
export const Languages = phosphorCompat(Translate, 'Languages');
export const LifeBuoy = phosphorCompat(Lifebuoy, 'LifeBuoy');
export const LocateFixed = phosphorCompat(Crosshair, 'LocateFixed');
export const Lock = phosphorCompat(PhosphorLock, 'Lock');
export const LogOut = phosphorCompat(SignOut, 'LogOut');
export const MapPin = phosphorCompat(PhosphorMapPin, 'MapPin');
export const MapPinOff = phosphorCompat(PhosphorMapPin, 'MapPinOff');
export const Megaphone = phosphorCompat(PhosphorMegaphone, 'Megaphone');
export const Menu = phosphorCompat(List, 'Menu');
export const MessageCircle = phosphorCompat(ChatCircle, 'MessageCircle');
export const Mic = phosphorCompat(Microphone, 'Mic');
export const Monitor = phosphorCompat(Desktop, 'Monitor');
export const Moon = phosphorCompat(PhosphorMoon, 'Moon');
export const MoonStar = phosphorCompat(MoonStars, 'MoonStar');
export const MoreVertical = phosphorCompat(DotsThreeVertical, 'MoreVertical');
export const Palette = phosphorCompat(PhosphorPalette, 'Palette');
export const Pause = phosphorCompat(PhosphorPause, 'Pause');
export const Pencil = phosphorCompat(PencilSimple, 'Pencil');
export const PencilLine = phosphorCompat(PencilSimpleLine, 'PencilLine');
export const Plane = phosphorCompat(AirplaneTilt, 'Plane');
export const Play = phosphorCompat(PhosphorPlay, 'Play');
export const Puzzle = phosphorCompat(PuzzlePiece, 'Puzzle');
export const Quote = phosphorCompat(Quotes, 'Quote');
export const RefreshCw = phosphorCompat(ArrowClockwise, 'RefreshCw');
export const Reply = phosphorCompat(ArrowBendUpLeft, 'Reply');
export const RotateCw = phosphorCompat(ArrowClockwise, 'RotateCw');
export const Ruler = phosphorCompat(PhosphorRuler, 'Ruler');
export const Search = phosphorCompat(MagnifyingGlass, 'Search');
export const Send = phosphorCompat(PaperPlaneTilt, 'Send');
export const ShieldAlert = phosphorCompat(ShieldWarning, 'ShieldAlert');
export const ShieldCheck = phosphorCompat(PhosphorShieldCheck, 'ShieldCheck');
export const Shirt = phosphorCompat(TShirt, 'Shirt');
export const ShoppingBag = phosphorCompat(PhosphorShoppingBag, 'ShoppingBag');
export const Signpost = phosphorCompat(PhosphorSignpost, 'Signpost');
export const Smartphone = phosphorCompat(DeviceMobile, 'Smartphone');
export const Sparkles = phosphorCompat(Sparkle, 'Sparkles');
export const Square = phosphorCompat(Stop, 'Square');
export const Star = phosphorCompat(PhosphorStar, 'Star');
export const Sun = phosphorCompat(PhosphorSun, 'Sun');
export const Trash2 = phosphorCompat(Trash, 'Trash2');
export const TriangleAlert = phosphorCompat(Warning, 'TriangleAlert');
export const Undo2 = phosphorCompat(ArrowUUpLeft, 'Undo2');
export const Unlock = phosphorCompat(LockOpen, 'Unlock');
export const User = phosphorCompat(PhosphorUser, 'User');
export const UserCog = phosphorCompat(UserGear, 'UserCog');
export const UserRound = phosphorCompat(PhosphorUser, 'UserRound');
export const UserRoundPlus = phosphorCompat(UserPlus, 'UserRoundPlus');
export const Users = phosphorCompat(PhosphorUsers, 'Users');
export const Users2 = phosphorCompat(PhosphorUsers, 'Users2');
export const UserX = phosphorCompat(UserMinus, 'UserX');
export const VenusAndMars = phosphorCompat(GenderIntersex, 'VenusAndMars');
export const WifiOff = phosphorCompat(WifiSlash, 'WifiOff');
export const Wine = phosphorCompat(PhosphorWine, 'Wine');
export const X = phosphorCompat(PhosphorX, 'X');
export const XCircle = phosphorCompat(PhosphorXCircle, 'XCircle');
