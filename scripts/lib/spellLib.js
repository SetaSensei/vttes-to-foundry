import * as moduleLib from "./moduleLib.js";


    export function getSpellActivation (spellInfos) {
        var activation = {
            type: '',
            cost: 0,
            condition: ''
        }

        var castingTime = spellInfos.spellcastingtime.current

        var commaIdx = castingTime.indexOf(',')
        if ( commaIdx >= 0) {
            activation.condition = castingTime.substring(commaIdx + 1)
            var timeRange = castingTime.substring(0, commaIdx).split(' ')
            activation.cost = timeRange[0]
            activation.type = timeRange[1]
        } else {
            var timeRange = castingTime.split(' ')
            activation.cost = timeRange[0]
            activation.type = timeRange[1]
        }

        return activation
    }

    const getSpellDuration = function(spellInfos) {
        var duration = {
            value: 0,
            units: ''
        }

        if (!spellInfos.spellduration) {
            return duration
        }

        var durationTime = spellInfos.spellduration.current

        if (durationTime.toLowerCase().indexOf('up to') >= 0) {
            durationTime = durationTime.substring(6)
        }

        var parts = durationTime.split(' ')
        if (moduleLib.TIME_TRANSLATE[parts[1]]){
            duration.units = moduleLib.TIME_TRANSLATE[parts[1]]
        } else {
            duration.units = parts[1]
        }
        
        duration.value = parseInt(parts[0])


        return duration
    }

    const getSpellRange = function(spellInfos) {
        var range = {}
        if (['Self', 'Touch'].indexOf(spellInfos.spellrange.current) < 0) {
            var rangeData = spellInfos.spellrange.current.split(' ');
            range.value = parseInt(rangeData[0]);
            range.long = 0;
            range.units = rangeData[1] == 'feet' ? 'ft' : rangeData[1];
        } else {
            range.units = spellInfos.spellrange.current.toLowerCase();
        }
        return range
    }

    const getSpellTarget = function(spellInfos) {
        return spellInfos.spelltarget.current
    }

    export function getActionType(spellInfos) {
        if (moduleLib.SPELL_TYPE_TO_ACTION[spellInfos.spellattack.current]) {
            return moduleLib.SPELL_TYPE_TO_ACTION[spellInfos.spellattack.current]
        }
        
        if (spellInfos.spellattack.current == '') {
            if (spellInfos.spelldamage.current != '') {
                return 'save'
            }
            if (spellInfos.spellhealing.current != '') {
                return 'heal'
            }
        }

        return 'util'
    }

    export function getDamages(spellInfos) {
        var damage = {
            parts: [],
            versatile: ''
        }

        var hasMod = spellInfos.spelldmgmod.current.toLowerCase() == 'yes'

        if (spellInfos.spellhealing && spellInfos.spellhealing.current != '') {
            var healingPart = `${spellInfos.spellhealing.current}${hasMod ? ' +@mod' : ''}`
            damage.parts.push([ healingPart, 'healing'])
        }

        if (spellInfos.spelldamage && spellInfos.spelldamage.current != '') {
            var damagePart = `${spellInfos.spelldamage.current}${hasMod ? ' +@mod' : ''}`
            damage.parts.push([ damagePart, spellInfos.spelldamagetype.current.toLowerCase()])
        }

        if (spellInfos.spelldamage2 && spellInfos.spelldamage2.current != '') {
            var damagePart = `${spellInfos.spelldamage2.current}${hasMod ? ' +@mod' : ''}`
            damage.parts.push([ spellInfos.spelldamage2.current + hasMod ? ' + @mod' : '', spellInfos.spelldamagetype2.current.toLowerCase()])
        }

        return damage
    }

    export function getScaling(spellInfos) {
        var scaling = {
            mode: '',
            formula: ''
        }

        if (spellInfos.spelllevel.current == 'cantrip') {
            scaling.mode = 'cantrip'
        } else {
            scaling.mode = 'level'
            if (spellInfos.spellhldie.current.indexOf('.') >= 0) {
                var constant = parseFloat(spellInfos.spellhldie.current)
                var formulaMult = Math.round(1 / constant)
                scaling.formula = 'floor((@item.level - 1)/' + formulaMult + ')'+ spellInfos.spellhldietype.current
            } else {
                scaling.formula = spellInfos.spellhldie.current + spellInfos.spellhldietype.current
            }
        }

        return scaling
    }

    export function getComponents(spellInfos) {
        var component = {
            vocal: spellInfos.spellcomp_v.current.length > 0,
            somatic: spellInfos.spellcomp_s.current.length > 0,
            material: spellInfos.spellcomp_m.current.length > 0,
            ritual: spellInfos.spellritual.current.length > 0,
            concentration: spellInfos.spellconcentration.current.length > 0,
            value: spellInfos.spellcomp_materials.current
        }

        return component
    }

    export function getMaterials(spellInfos) {
        var materials = {
            consumed: false,
            cost: 0,
            supply: 0,
            value: spellInfos.spellcomp_materials.current
        }
        
        return materials
    }

    export function getSave(spellInfos) {
        var save = {
            ability: moduleLib.ABILITIES[spellInfos.spellsave.current],
            dc: null,
            scaling: spellInfos.spell_ability.current
        }

        return save
    }

    export function getSpellSchool(spellInfos) {
        return moduleLib.SPELL_SCHOOLS[spellInfos.spellschool.current]
    }

    export function isPactMagic(spellInfos) {
        return spellInfos.spellclass.current.toLowerCase().indexOf('warlock') >= 0;
    }

    export function getPreparation(spellInfos) {
        var preparation = {
            mode: 'prepared',
            prepared: false
        }

        if (this.isPactMagic(spellInfos) && spellInfos.spelllevel.current != 'cantrip') {
            preparation = {
                mode: 'pact',
                prepared: true
            }
        }

        if (spellInfos.innate && spellInfos.innate.current.length > 0) {
            preparation = {
                mode: 'innate',
                prepared: true
            }
        }

        return preparation
    }

export {getSpellTarget, getSpellRange, getSpellDuration}
