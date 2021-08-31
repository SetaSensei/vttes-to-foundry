const LOG_PREFIX = 'VTTES2FVTT'

const LOCAL_CONFIG = {
    environment: "prod"
}

const getFolderPath = function() {
    if (LOCAL_CONFIG.environment === 'dev') {
        return 'modules/vttes-to-foundry-dev/'
    }
    return 'modules/vttes-to-foundry/'
}

const vttLog = function (message, showOnUI = false) {
    console.log(`${LOG_PREFIX} - ${message}`)

    if (showOnUI) {
        ui.notifications.info(message)
    }
}

const vttError = function (message, showOnUI = false) {
    console.error(`${LOG_PREFIX} - ${message}`)

    if (showOnUI) {
        ui.notifications.error(message)
    }
}

const vttWarn = function (message, showOnUI = false) {
    console.warn(`${LOG_PREFIX} - ${message}`)

    if (showOnUI) {
        ui.notifications.warn(message)
    }
}

const capitalizeFirstLetter = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const  getSizeCode = function (size) {
   return VTTES_TO_FOUNDRY_SIZES[size]
}

const  getArmorTypeAndDexLimit = function(armor) {
    var typeName = ARMOR_TYPES[armor]
    var maxDex = getArmorLimit(typeName)

    return {typeName, maxDex}
}

const getArmorLimit = function(armor) {
    return armor === 'medium' ? 2 : armor === 'heavy' ? 0 : null
}

const getAttackType = function(attackType) {
    return ATTACK_TYPES[attackType]
}

const getAttackTypeFromWeaponType = function(weaponType) {
    return WEAPON_TYPE_TO_ACTION[weaponType]
}

const VTTES_TO_FOUNDRY_SIZES = {
    tiny: "tiny",
    small: "sm",
    medium : "med",
    large: "lg",
    huge: "huge",
    gargantuan: "grg"
}

const ATTACK_TYPES = {
    "Melee": "mwak",
    "Ranged": "rwak",
    "Melee Spell Attack": "msak",
    "Ranged Spell Attack": "rsak"
    // test: "save",
    // test: "heal",
    // test: "abil",
    // test: "util",
    // test: "other",
}

const ARMOR_TYPES = {
    "Light Armor": "light",
    "Medium Armor": "medium",
    "Heavy Armor": "heavy",
    "Natural Armor": "natural",
    "Shield": "shield"
}

const WEAPON_TYPE_TO_ACTION = {
    "Melee Spell" : "msak",
    "Melee Weapon" : "mwak",
    "Ranged Spell": "rsak",
    "Ranged Weapon" : "rwak",
    "Other": "other"
}

const WEAPON_TYPES = 
    {
        "Adamantite" : "ada",
        "Ammunition": "amm",
        "Finesse" : "fin",
        // "fir": "DND5E.WeaponPropertiesFir",
        "Focus" : "foc",
        "Heavy": "hvy",
        "Light" : "lgt",
        // "lod": "DND5E.WeaponPropertiesLod",
        // "mgc": "DND5E.WeaponPropertiesMgc",
        "Reach": "rch",
        // "rel": "DND5E.WeaponPropertiesRel",
        // "ret": "DND5E.WeaponPropertiesRet",
        // "sil": "DND5E.WeaponPropertiesSil",
        // "spc": "DND5E.WeaponPropertiesSpc",
        "Thrown" : "thr",
        "Two-Handed": "two",
        "Versatile": "ver"
      }

export {vttLog, vttWarn, vttError, getAttackTypeFromWeaponType, capitalizeFirstLetter, getSizeCode, getArmorTypeAndDexLimit as getArmorType, getFolderPath}
