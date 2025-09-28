// Character state
let character = {
    // Added fields for character and player names
    characterName: '',
    playerName: '',
    heritage: '',
    concept: '',
    position: '',
    trouble: '',
    secret: '',
    skills: {
        strength: 0,
        warfare: 0,
        psyche: 0,
        endurance: 0,
        status: 0,
        intrigue: 0,
        hunting: 0,
        lore: 0
    },
    powers: [],
    extras: [],
    totalPoints: 60,
    usedPoints: 0,
    heritagePoints: 0
};

let extraIdCounter = 0;
let featureInstanceCounter = 0;
let gmPowerCosts = {};

// Heritage management
function updateHeritage() {
    const heritage = document.getElementById('heritage').value;
    const heritageInfo = document.getElementById('heritageInfo');
    
    character.heritage = heritage;
    
    let heritageDescription = '';
    let heritagePoints = 0;
    
    // Reset heritage-specific power states
    document.getElementById('pattern-adept').disabled = false;
    document.getElementById('shapeshifting').disabled = false;
    
    switch(heritage) {
        case 'recognized-amber':
            heritageDescription = 'Free Pattern Adept power. Gains Court position, Blood Curse, and Slow Regeneration.';
            heritagePoints = 0;
            // Auto-enable Pattern Adept
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('pattern-adept').disabled = true;
            break;
        case 'unrecognized-amber':
            heritageDescription = 'Gain 5 points. Has Blood Curse and Slow Regeneration. Work with GM for details.';
            heritagePoints = 5;
            break;
        case 'chaos':
            heritageDescription = 'Gain 2 points. Free Shapeshifting power.';
            heritagePoints = 2;
            // Auto-enable Shapeshifting
            document.getElementById('shapeshifting').checked = true;
            document.getElementById('shapeshifting').disabled = true;
            break;
        case 'both':
            heritageDescription = 'Costs 3 points. Recognized status, Court position, Blood Curse, Slow Regeneration, Pattern, and Shapeshifting.';
            heritagePoints = -3;
            // Auto-enable both Pattern and Shapeshifting
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('pattern-adept').disabled = true;
            document.getElementById('shapeshifting').checked = true;
            document.getElementById('shapeshifting').disabled = true;
            break;
        case 'other':
            heritageDescription = 'Gain 6 points. Work with GM to create custom heritage.';
            heritagePoints = 6;
            break;
        default:
            heritageDescription = '';
            heritagePoints = 0;
            break;
    }
    
    character.heritagePoints = heritagePoints;
    
    if (heritageDescription) {
        heritageInfo.innerHTML = heritageDescription;
        heritageInfo.style.display = 'block';
    } else {
        heritageInfo.style.display = 'none';
    }
    
    updatePointsDisplay();
    updatePowers();
    saveCharacter();
}

// Skills management
function updateSkills() {
    const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    
    skills.forEach(skill => {
        const value = parseInt(document.getElementById(skill).value) || 0;
        character.skills[skill] = value;
        
        // Calculate cost (only positive values above 0 cost points)
        const cost = Math.max(0, value);
        document.getElementById(skill + 'Cost').textContent = `Cost: ${cost} points`;
    });
    
    updatePointsDisplay();
    saveCharacter();
}

// GM Power cost management
function updateGMPowerCost(powerId) {
    const costInput = document.getElementById(powerId + '-manual-cost');
    const cost = parseInt(costInput.value) || 0;
    gmPowerCosts[powerId] = cost;
    
    const costSpan = document.getElementById(powerId + '-cost');
    costSpan.textContent = cost > 0 ? cost.toString() : 'GM';
    
    updatePointsDisplay();
    saveCharacter();
}

// Powers management
function updatePowers() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    character.powers = [];
    
    powerElements.forEach(element => {
        if (element.checked) {
            let powerCost = parseInt(element.dataset.cost);
            
            // Check if this is a GM power with manual cost
            if (element.dataset.gmCost === 'true' && gmPowerCosts[element.id]) {
                powerCost = gmPowerCosts[element.id];
            }
            
            character.powers.push({
                id: element.id,
                cost: powerCost,
                prereq: element.dataset.prereq,
                credit: element.dataset.credit
            });
        }
    });
    
    // Check prerequisites and enable/disable powers
    powerElements.forEach(element => {
        const prereq = element.dataset.prereq;
        if (prereq && !element.disabled) {
            const prereqMet = document.getElementById(prereq).checked;
            element.parentElement.parentElement.classList.toggle('disabled', !prereqMet);
            if (!prereqMet && element.checked) {
                element.checked = false;
            }
        }
    });
    
    // Update power costs display
    updatePowerCosts();
    updatePointsDisplay();
    saveCharacter();
}

function updatePowerCosts() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    
    powerElements.forEach(element => {
        const powerId = element.id;
        const baseCost = parseInt(element.dataset.cost);
        const costSpan = document.getElementById(powerId + '-cost');
        
        if (!costSpan) return;
        
        let finalCost = baseCost;
        let isFree = false;
        let isDiscounted = false;
        
        // Check if this is a GM power
        if (element.dataset.gmCost === 'true') {
            const manualCost = gmPowerCosts[powerId] || 0;
            finalCost = manualCost;
            costSpan.textContent = manualCost > 0 ? manualCost.toString() : 'GM';
            costSpan.className = 'power-cost gm';
            return;
        }
        
        // Check if this power is free from heritage
        if (isHeritageFreePower(powerId)) {
            finalCost = 0;
            isFree = true;
        } else {
            // Apply credits from other powers
            if (element.dataset.credit && element.checked) {
                const credits = element.dataset.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        finalCost += parseInt(creditValue); // creditValue is already negative
                        isDiscounted = true;
                    }
                });
            }
        }
        
        // Update the display
        costSpan.textContent = finalCost === 0 ? 'Free' : finalCost.toString();
        costSpan.className = 'power-cost';
        
        if (isFree) {
            costSpan.classList.add('free');
        } else if (isDiscounted) {
            costSpan.classList.add('discounted');
        }
    });
}

function isHeritageFreePower(powerId) {
    const heritage = character.heritage;
    if (heritage === 'recognized-amber' && powerId === 'pattern-adept') return true;
    if (heritage === 'chaos' && powerId === 'shapeshifting') return true;
    if (heritage === 'both' && (powerId === 'pattern-adept' || powerId === 'shapeshifting')) return true;
    return false;
}

// Extras management
function addExtra() {
    const extraId = 'extra_' + (++extraIdCounter);
    const extra = {
        id: extraId,
        name: '',
        type: '',
        isSimple: true,
        simpleAspect: '',
        features: [],
        isEditing: true
    };
    
    character.extras.push(extra);
    renderExtra(extra);
    updatePointsDisplay();
}

function removeExtra(extraId) {
    character.extras = character.extras.filter(e => e.id !== extraId);
    document.getElementById(extraId).remove();
    updatePointsDisplay();
    saveCharacter();
}

function renderExtra(extra) {
    const container = document.getElementById('extrasContainer');
    const extraDiv = document.getElementById(extra.id) || document.createElement('div');
    
    if (!extraDiv.id) {
        extraDiv.id = extra.id;
        extraDiv.className = 'power-category';
        extraDiv.style.marginBottom = '20px';
        container.appendChild(extraDiv);
    }
    
    if (extra.isEditing) {
        extraDiv.innerHTML = renderExtraEditMode(extra);
    } else {
        extraDiv.innerHTML = renderExtraDisplayMode(extra);
    }
}

function renderExtraEditMode(extra) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">Extra: ${extra.name || 'Unnamed'}</h3>
            <div>
                <button type="button" class="export-btn" onclick="saveExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin-right: 5px;">Save</button>
                <button type="button" class="reset-btn" onclick="removeExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin: 0;">Remove</button>
            </div>
        </div>
        
        <div class="form-group">
            <label>Name:</label>
            <input type="text" id="${extra.id}_name" value="${extra.name}" placeholder="e.g., Loyal Steed, Ancestral Sword, Shadow Realm" onchange="updateExtraName('${extra.id}')">
        </div>
        
        <div class="form-group">
            <label>Type:</label>
            <select id="${extra.id}_type" onchange="updateExtraType('${extra.id}')">
                <option value="">Select Type...</option>
                <option value="ally" ${extra.type === 'ally' ? 'selected' : ''}>Ally (pets, servants, associates, contacts)</option>
                <option value="domain" ${extra.type === 'domain' ? 'selected' : ''}>Domain (shadow, location, land)</option>
                <option value="item" ${extra.type === 'item' ? 'selected' : ''}>Item (weapon, tool, device)</option>
                <option value="mastery" ${extra.type === 'mastery' ? 'selected' : ''}>Mastery (training, knowledge, natural ability)</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>
                <input type="radio" name="${extra.id}_simple" value="true" ${extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', true)">
                Simple (Name + Aspect + Invokes)
            </label>
            <label>
                <input type="radio" name="${extra.id}_simple" value="false" ${!extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', false)">
                Custom (Detailed Features)
            </label>
        </div>
        
        <div id="${extra.id}_simple_options" style="display: ${extra.isSimple ? 'block' : 'none'};">
            <div class="form-group">
                <label>Aspect:</label>
                <input type="text" id="${extra.id}_aspect" value="${extra.simpleAspect}" placeholder="e.g., Swift as the Wind, Unbreakable Bond" onchange="updateExtraAspect('${extra.id}')">
            </div>
            <div class="heritage-info">
                <strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.
            </div>
        </div>
        
        <div id="${extra.id}_custom_options" style="display: ${extra.isSimple ? 'none' : 'block'};">
            ${renderCustomOptions(extra)}
        </div>
        
        <div class="skill-cost">
            <strong>Total Cost: ${calculateExtraCost(extra)} points</strong>
        </div>
    `;
}

function renderExtraDisplayMode(extra) {
    const extraName = extra.name || 'Unnamed Extra';
    const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
    const extraCost = calculateExtraCost(extra);
    const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
    
    let details = '';
    // Build detailed description for the extra
    if (extra.isSimple && extra.simpleAspect) {
        // Simple extras just display the aspect
        details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">Aspect: ${extra.simpleAspect}</div>`;
    } else if (!extra.isSimple && extra.features.length > 0) {
        // Build a list of details for each feature instance
        const lines = [];
        extra.features.forEach(feature => {
            const fname = feature.name;
            switch (fname) {
                case 'Training':
                    if (feature.skill) {
                        const lvl = parseInt(feature.level) || 0;
                        if (lvl !== 0) {
                            const skillDisplay = feature.skill
                                .replace(/-/g, ' ')
                                .replace(/\b\w/g, l => l.toUpperCase());
                            lines.push(`Training: +${lvl} to ${skillDisplay}`);
                        }
                    }
                    break;
                case 'Skilled':
                    if (Array.isArray(feature.skillMods) && feature.skillMods.length > 0) {
                        const mods = feature.skillMods.map(sm => {
                            if (!sm.skill || sm.value === undefined || sm.value === null || isNaN(sm.value)) return null;
                            const sname = sm.skill.charAt(0).toUpperCase() + sm.skill.slice(1);
                            return `${sname} (${sm.value >= 0 ? '+' : ''}${sm.value})`;
                        }).filter(Boolean);
                        if (mods.length > 0) {
                            lines.push(`Skilled: ${mods.join(', ')}`);
                        }
                    }
                    break;
                case 'Focus':
                    if (feature.skill) {
                        const sname = feature.skill.charAt(0).toUpperCase() + feature.skill.slice(1);
                        const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                        lines.push(`Focus: +2 to ${sname}${when}`);
                    }
                    break;
                case 'Flexible':
                    if (feature.skillUsed && feature.skillReplaced) {
                        const used = feature.skillUsed.charAt(0).toUpperCase() + feature.skillUsed.slice(1);
                        const repl = feature.skillReplaced.charAt(0).toUpperCase() + feature.skillReplaced.slice(1);
                        const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                        lines.push(`Flexible: Use ${used} for ${repl}${when}`);
                    }
                    break;
                case 'Technique':
                    if (feature.ability) {
                        lines.push(`Technique: ${feature.ability}`);
                    }
                    break;
                case 'Talented':
                case 'Unusual':
                case 'Primal Born':
                    if (feature.description) {
                        lines.push(`${fname}: ${feature.description}`);
                    }
                    break;
                case 'Aspect':
                    if (feature.description) {
                        lines.push(`Aspect: ${feature.description}`);
                    }
                    break;
                default:
                    if (feature.description) {
                        lines.push(`${fname}: ${feature.description}`);
                    }
                    break;
            }
        });
        if (lines.length > 0) {
            details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">${lines.join('<br>')}</div>`;
        }
    }

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0;">${extraName}${extraType}${costText}</h3>
            <div>
                <button type="button" class="export-btn" onclick="editExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin-right: 5px;">Edit</button>
                <button type="button" class="reset-btn" onclick="removeExtra('${extra.id}')" style="font-size: 0.8em; padding: 5px 10px; margin: 0;">Remove</button>
            </div>
        </div>
        ${details}
    `;
}

function editExtra(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.isEditing = true;
    renderExtra(extra);
}

function saveExtra(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.isEditing = false;
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
}

function getSimpleInvokes(type) {
    switch(type) {
        case 'domain': return 2;
        case 'ally':
        case 'item':
        case 'mastery':
        default: return 1;
    }
}

function renderCustomOptions(extra) {
    if (!extra.type) return '<p style="color: #cccccc; font-style: italic;">Select a type to see custom options.</p>';
    
    const features = getAvailableFeatures(extra.type);
    let html = '<h4 style="color: #EFBF04; margin-bottom: 10px;">Available Features:</h4>';
    
    features.forEach(feature => {
        const instances = extra.features.filter(f => f.name === feature.name);
        const hasInstances = instances.length > 0;
        const isRequired = feature.required && !extra.features.some(f => f.name === feature.required);
        const disabled = isRequired ? 'disabled' : '';
        const disabledClass = isRequired ? 'disabled' : '';
        
        html += `
            <div class="power-item ${disabledClass}">
                <label>
                    <input type="checkbox" ${hasInstances ? 'checked' : ''} ${disabled} 
                           onchange="toggleExtraFeature('${extra.id}', '${feature.name}', ${feature.cost}, '${feature.required || ''}')">
                    <span class="power-cost">${feature.cost === 0 ? 'Free' : feature.cost < 0 ? `+${Math.abs(feature.cost)}` : feature.cost}</span>
                    ${feature.name}
                </label>
                <div class="power-description">${feature.description}</div>
                
                ${hasInstances ? renderFeatureInstances(extra.id, feature.name, instances) : ''}
            </div>
        `;
    });
    
    return html;
}

function renderFeatureInstances(extraId, featureName, instances) {
    let html = '<div class="feature-instances" style="margin-top: 10px;">';
    
    instances.forEach((instance, index) => {
        html += `
            <div class="feature-instance">
                <div class="feature-instance-header">
                    <span class="feature-instance-title">${featureName} #${index + 1}</span>
                    <button type="button" class="remove-instance-btn" onclick="removeFeatureInstance('${extraId}', '${featureName}', ${index})">×</button>
                </div>
                ${renderFeatureInstanceContent(extraId, featureName, instance, index)}
            </div>
        `;
    });
    
    html += `<button type="button" class="add-instance-btn" onclick="addFeatureInstance('${extraId}', '${featureName}')">Add Another ${featureName}</button>`;
    html += '</div>';
    
    return html;
}

function renderFeatureInstanceContent(extraId, featureName, instance, index) {
    // Build lists of selectable attributes for the various custom features.
    // Base skills always include the core eight stats.
    const baseSkills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    // Skill options for the "Skilled" feature remain restricted to the base skills.
    const skillOptions = baseSkills;
    // When configuring a Training feature, players may target either a base skill or an advanced power.
    // Gather any advanced powers the character currently has selected.
    const selectedAdvanced = (character.powers || [])
        .filter(p => p.id && p.id.startsWith('advanced-'))
        .map(p => p.id);
    const selectableOptions = [...baseSkills, ...selectedAdvanced];
    // Convert the combined list into option tags for select inputs.  Display names are prettified.
    const skillSelect = selectableOptions.map(opt => {
        const display = opt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `<option value="${opt}" ${instance.skill === opt ? 'selected' : ''}>${display}</option>`;
    }).join('');
    
    switch(featureName) {
        case 'Skilled':
            return `
                <div class="form-group">
                    <label>Skills to Modify:</label>
                    <div>
                        ${(instance.skillMods || []).map((mod, idx) => `
                            <div class="skill-selection" style="margin-bottom: 5px;">
                                <select onchange="updateSkillMod('${extraId}', '${featureName}', ${index}, ${idx}, 'skill', this.value)">
                                    <option value="">Select Skill...</option>
                                    ${skillOptions.map(skill => `<option value="${skill}" ${mod.skill === skill ? 'selected' : ''}>${skill.charAt(0).toUpperCase() + skill.slice(1)}</option>`).join('')}
                                </select>
                                <input type="number" min="-3" max="12" value="${mod.value || 0}" 
                                       onchange="updateSkillMod('${extraId}', '${featureName}', ${index}, ${idx}, 'value', this.value)" placeholder="Value">
                                <button type="button" class="remove-instance-btn" onclick="removeSkillMod('${extraId}', '${featureName}', ${index}, ${idx})">×</button>
                            </div>
                        `).join('')}
                        <button type="button" class="add-instance-btn" onclick="addSkillMod('${extraId}', '${featureName}', ${index})" style="font-size: 0.7em; padding: 3px 6px;">Add Skill</button>
                    </div>
                </div>
            `;
        case 'Flexible':
            return `
                <div class="form-group">
                    <label>Use 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skillUsed', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${skillSelect}
                        </select> 
                        in place of 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skillReplaced', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${skillSelect}
                        </select> 
                        when:
                    </label>
                    <input type="text" placeholder="e.g., researching ancient families" value="${instance.circumstance || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)" style="width: 100%; margin-top: 5px;">
                </div>
            `;
        case 'Focus':
            return `
                <div class="form-group">
                    <label>+2 to 
                        <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                            <option value="">skill</option>
                            ${skillSelect}
                        </select> 
                        when:
                    </label>
                    <input type="text" placeholder="e.g., fighting in your home domain" value="${instance.circumstance || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)" style="width: 100%; margin-top: 5px;">
                </div>
            `;
        case 'Technique':
            return `
                <div class="form-group">
                    <label>Power Ability:</label>
                    <input type="text" placeholder="e.g., Trump Defense from Trump Artist" value="${instance.ability || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'ability', this.value)" style="width: 100%;">
                </div>
            `;
        case 'Training':
            return `
                <div class="form-group">
                    <label>Skill to Improve:</label>
                    <select onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="width: 100%;">
                        <option value="">Select Skill...</option>
                        ${skillSelect}
                    </select>
                    <label style="margin-top: 10px;">Improvement Level (+1 per point):</label>
                    <input type="number" min="1" max="5" value="${instance.level || 1}" 
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'level', this.value)" style="width: 100%;">
                </div>
            `;
        case 'Talented':
        case 'Unusual':
        case 'Primal Born':
            return `
                <div class="form-group">
                    <label>Description:</label>
                    <textarea placeholder="Describe the custom ability..." 
                              onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                              style="width: 100%; height: 60px; resize: vertical;">${instance.description || ''}</textarea>
                    <label style="margin-top: 10px;">GM-determined Cost:</label>
                    <input type="number" placeholder="Points" value="${instance.manualCost || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'manualCost', this.value)" style="width: 100%;">
                </div>
            `;
        default:
            return `
                <div class="form-group">
                    <label>Notes:</label>
                    <input type="text" placeholder="Additional details..." value="${instance.description || ''}"
                           onchange="updateFeatureData('${extraId}', '${featureName}', ${index}, 'description', this.value)" style="width: 100%;">
                </div>
            `;
    }
}

function updateFeatureData(extraId, featureName, instanceIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (instance) {
        instance[field] = field === 'level' || field === 'manualCost' ? parseInt(value) || 0 : value;
        updatePointsDisplay();
        saveCharacter();
    }
}

function addSkillMod(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance.skillMods) instance.skillMods = [];
    instance.skillMods.push({ skill: '', value: 0 });
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    saveCharacter();
}

function removeSkillMod(extraId, featureName, instanceIndex, skillIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    instance.skillMods.splice(skillIndex, 1);
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    saveCharacter();
}

function updateSkillMod(extraId, featureName, instanceIndex, skillIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance.skillMods) instance.skillMods = [];
    if (!instance.skillMods[skillIndex]) instance.skillMods[skillIndex] = {};
    
    instance.skillMods[skillIndex][field] = field === 'value' ? parseInt(value) : value;
    updatePointsDisplay();
    saveCharacter();
}

function addFeatureInstance(extraId, featureName) {
    const extra = character.extras.find(e => e.id === extraId);
    const feature = getAvailableFeatures(extra.type).find(f => f.name === featureName);
    
    const newInstance = {
        name: featureName,
        cost: feature.cost,
        instanceIndex: featureInstanceCounter++
    };
    
    // Initialize specific data based on feature type
    switch(featureName) {
        case 'Skilled':
            newInstance.skillMods = [];
            break;
        case 'Training':
            newInstance.skill = '';
            newInstance.level = 1;
            break;
        case 'Flexible':
            newInstance.skillUsed = '';
            newInstance.skillReplaced = '';
            newInstance.circumstance = '';
            break;
        case 'Focus':
            newInstance.skill = '';
            newInstance.circumstance = '';
            break;
        case 'Technique':
            newInstance.ability = '';
            break;
        case 'Talented':
        case 'Unusual':
        case 'Primal Born':
            newInstance.description = '';
            newInstance.manualCost = 0;
            break;
        default:
            newInstance.description = '';
            break;
    }
    
    extra.features.push(newInstance);
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    updatePointsDisplay();
    saveCharacter();
}

function removeFeatureInstance(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        const indexToRemove = extra.features.findIndex(f => f.name === featureName && instances.indexOf(f) === instanceIndex);
        if (indexToRemove >= 0) {
            extra.features.splice(indexToRemove, 1);
        }
        
        const remainingInstances = extra.features.filter(f => f.name === featureName);
        if (remainingInstances.length === 0) {
            const checkbox = document.querySelector(`#${extraId}_custom_options input[onchange*="${featureName}"]`);
            if (checkbox) checkbox.checked = false;
        }
        
        const customDiv = document.getElementById(extraId + '_custom_options');
        customDiv.innerHTML = renderCustomOptions(extra);
        
        updatePointsDisplay();
        saveCharacter();
    }
}

function toggleExtraFeature(extraId, featureName, cost, required) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        // Remove all instances of this feature
        extra.features = extra.features.filter(f => f.name !== featureName);
    } else {
        // Add first instance of this feature
        addFeatureInstance(extraId, featureName);
        return; // addFeatureInstance already handles the re-render
    }
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    updatePointsDisplay();
    saveCharacter();
}

function getAvailableFeatures(type) {
    const features = {
        ally: [
            { name: 'Base Cost', cost: 0.5, required: '', description: 'REQUIRED FIRST. Ally starts with an Aspect, one Skill at Amber (0), another at Chaos (-1), and 2 mild stress boxes.' },
            { name: 'Organization', cost: 1, required: 'Base Cost', description: 'Has many members. Ability to affect things at scale. Start with one face (named member).' },
            { name: 'Aspect', cost: 0.5, required: 'Base Cost', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Bound', cost: 1, required: 'Base Cost', description: 'May use Ally\'s senses, Skills, or Powers (w/ concentration).' },
            { name: 'Resolute', cost: 0.25, required: 'Base Cost', description: 'Gives Ally +1 to psychic defense.' },
            { name: 'Skilled', cost: 0.5, required: 'Base Cost', description: 'Additional Amber and Chaos skill plus 3 points to buy Skills, Powers, etc.' },
            { name: 'Sturdy', cost: 0.25, required: 'Base Cost', description: 'Add one mild stress box. If bought thrice, may add moderate boxes.' },
            { name: 'Unusual', cost: 0, required: 'Base Cost', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: 'Base Cost', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        domain: [
            { name: 'Aspect', cost: 0.25, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Barrier', cost: 0.25, required: '', description: 'Each time purchased blocks one Power from Domain.' },
            { name: 'Control', cost: 0.25, required: '', description: 'Each time purchased gives +1 to control Domain.' },
            { name: 'Exceptional', cost: 0.5, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 0.5, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Security', cost: 0.25, required: '', description: 'Each purchase gives +1 to secure Domain.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        item: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.' },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ],
        mastery: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.' },
            { name: 'Dominant', cost: 4, required: '', description: 'Increases the Scale of one Skill to Legendary. Only one Skill allowed.' },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.' },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].' },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].' },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.' },
            { name: 'Immortal', cost: 1, required: '', description: 'Will recover from most any damage over time.' },
            { name: 'Incandescent', cost: 1, required: '', description: 'Lose all Power initiations, immune to Unmaking.' },
            { name: 'Primal Born', cost: 0, required: '', description: 'Requires Incandescent and Immortal, activated Ancient Heritage (see GM for cost and effects).' },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.' },
            { name: 'Talented', cost: 0, required: '', description: 'Design a unique skill with custom abilities (see GM for cost).' },
            { name: 'Technique', cost: 0.5, required: '', description: 'Add one ability from a Power. If full Power acquired later, this refunds back.' },
            { name: 'Training', cost: 1, required: '', description: '1 point per +1 to Skill. Improve Advanced Power or Unique Skill.' },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above (see GM for cost).' },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back.' }
        ]
    };
    
    return features[type] || [];
}

function updateExtraName(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const nameInput = document.getElementById(extraId + '_name');
    extra.name = nameInput.value;
    
    const header = document.querySelector(`#${extraId} h3`);
    header.textContent = `Extra: ${extra.name || 'Unnamed'}`;
    
    saveCharacter();
}

function updateExtraType(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const typeSelect = document.getElementById(extraId + '_type');
    extra.type = typeSelect.value;
    extra.features = [];
    
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    const simpleDiv = document.getElementById(extraId + '_simple_options');
    const heritageInfo = simpleDiv.querySelector('.heritage-info');
    heritageInfo.innerHTML = `<strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.`;
    
    updatePointsDisplay();
    saveCharacter();
}

function updateExtraMode(extraId, isSimple) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.isSimple = isSimple;
    
    document.getElementById(extraId + '_simple_options').style.display = isSimple ? 'block' : 'none';
    document.getElementById(extraId + '_custom_options').style.display = isSimple ? 'none' : 'block';
    
    updatePointsDisplay();
    saveCharacter();
}

function updateExtraAspect(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const aspectInput = document.getElementById(extraId + '_aspect');
    extra.simpleAspect = aspectInput.value;
    saveCharacter();
}

function calculateExtraCost(extra) {
    if (!extra.type) return 0;
    
    if (extra.isSimple) {
        return 1;
    } else {
        return extra.features.reduce((total, feature) => {
            let featureCost = feature.cost;
            
            // Handle special cases
            if (feature.name === 'Training' && feature.level) {
                featureCost = feature.level; // 1 point per +1
            } else if ((feature.name === 'Talented' || feature.name === 'Unusual' || feature.name === 'Primal Born') && feature.manualCost !== undefined) {
                featureCost = feature.manualCost; // GM-determined cost
            }
            
            return total + featureCost;
        }, 0);
    }
}

// Points calculation
function calculateUsedPoints() {
    let total = 0;
    
    // Add heritage points (can be negative)
    total += character.heritagePoints;
    
    // Calculate skill costs
    Object.values(character.skills).forEach(value => {
        total += Math.max(0, value);
    });
    
    // Calculate power costs with heritage discounts and credits
    character.powers.forEach(power => {
        let powerCost = power.cost;
        
        // Apply heritage discounts first
        if (isHeritageFreePower(power.id)) {
            powerCost = 0;
        } else {
            // Apply credits only if power wasn't free from heritage
            if (power.credit) {
                const credits = power.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        powerCost += parseInt(creditValue);
                    }
                });
            }
        }
        
        total += Math.max(0, powerCost);
    });
    
    // Calculate extras costs
    character.extras.forEach(extra => {
        total += calculateExtraCost(extra);
    });
    
    return total;
}

/**
 * Aggregate skill modifiers granted by Extras.  Certain custom features on
 * Extras allow players to modify a skill’s base rating.  For example, the
 * “Skilled” feature supports arbitrary skill modifiers via the skillMods
 * array and “Training” provides a +1 per level to a single skill.  This
 * helper walks through all extras and collects these modifications keyed
 * by skill name.  The returned object has the shape
 *   {
 *     skillName: [ { extraName: string, featureName: string, value: number }, ... ],
 *     ...
 *   }
 * Only modifiers with a numeric value are returned; other feature types
 * provide situational bonuses and are represented in the extras detail
 * section instead of here.
 */
function getSkillModifiers() {
    const modifiers = {};
    character.extras.forEach(extra => {
        // Only complex extras can modify skills; simple extras just have an aspect
        if (!extra.isSimple && extra.features && extra.features.length > 0) {
            extra.features.forEach(feature => {
                const featureName = feature.name;
                // Skilled feature: arbitrary skill modifications
                if (featureName === 'Skilled' && Array.isArray(feature.skillMods)) {
                    feature.skillMods.forEach(mod => {
                        // Skip incomplete entries
                        if (!mod.skill || mod.value === undefined || mod.value === null || isNaN(mod.value)) return;
                        const skill = mod.skill;
                        const value = parseInt(mod.value);
                        if (!modifiers[skill]) modifiers[skill] = [];
                        modifiers[skill].push({ extraName: extra.name || 'Extra', featureName: featureName, value: value });
                    });
                }
                // Training feature: +level to specified skill
                if (featureName === 'Training' && feature.skill) {
                    const skill = feature.skill;
                    const level = parseInt(feature.level) || 0;
                    if (level !== 0) {
                        if (!modifiers[skill]) modifiers[skill] = [];
                        modifiers[skill].push({ extraName: extra.name || 'Extra', featureName: featureName, value: level });
                    }
                }
            });
        }
    });
    return modifiers;
}
function updatePointsDisplay() {
    character.usedPoints = calculateUsedPoints();
    const remaining = character.totalPoints - character.usedPoints;
    
    document.getElementById('pointsRemaining').textContent = remaining;
    
    const statusDiv = document.getElementById('pointsStatus');
    if (remaining < 0) {
        statusDiv.innerHTML = '<div class="points-warning">Over Budget!</div>';
        document.getElementById('pointsRemaining').className = 'points-remaining points-warning';
    } else if (remaining === 0) {
        statusDiv.innerHTML = '<div class="success">Perfect!</div>';
        document.getElementById('pointsRemaining').className = 'points-remaining';
    } else {
        statusDiv.innerHTML = '';
        document.getElementById('pointsRemaining').className = 'points-remaining';
    }
    
    updateCharacterSummary();
}

function updateCharacterSummary() {
    const summaryDiv = document.getElementById('characterSummary');
    
    // Retrieve names from inputs to ensure current values are displayed
    const charName = document.getElementById('characterName') ? document.getElementById('characterName').value : '';
    const playerName = document.getElementById('playerName') ? document.getElementById('playerName').value : '';
    
    let html = '';
    
    // Overview section
    html += '<div class="summary-section">';
    html += '<h3>Overview</h3>';
    html += '<ul class="summary-list">';
    if (charName) html += `<li>Character: ${charName}</li>`;
    if (playerName) html += `<li>Player: ${playerName}</li>`;
    if (character.heritage) {
        const heritageDisplay = character.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        // Always show the heritage point adjustment, even when it is zero, to make the point impact explicit.
        const heritagePointsDisplay = ` (${character.heritagePoints > 0 ? '+' : ''}${character.heritagePoints} pts)`;
        html += `<li>Heritage: ${heritageDisplay}${heritagePointsDisplay}</li>`;
    }
    html += '</ul>';
    html += '</div>';
    
    // Skills section
    html += '<div class="summary-section">';
    html += '<h4>Skills</h4>';
    html += '<ul class="summary-list">';
    // Gather all skill modifiers from extras
    const skillModifiers = getSkillModifiers();
    Object.entries(character.skills).forEach(([skill, baseValue]) => {
        const skillName = skill.charAt(0).toUpperCase() + skill.slice(1);
        const baseCost = Math.max(0, baseValue);
        // Build modifier summary for this skill
        const mods = skillModifiers[skill] || [];
        let modSum = 0;
        let modDetails = '';
        if (mods.length > 0) {
            // Sum the modifier values and build a descriptive string
            const modStrings = mods.map(mod => {
                modSum += mod.value;
                return `${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.featureName} from ${mod.extraName})`;
            });
            modDetails = modStrings.join(', ');
        }
        const totalValue = baseValue + modSum;
        // Compose row: display base, mods and total clearly
        let row = `${skillName}: ${baseValue >= 0 ? '+' : ''}${baseValue}`;
        if (mods.length > 0) {
            row += `, ${modDetails} → ${totalValue >= 0 ? '+' : ''}${totalValue}`;
        } else {
            // If no modifiers, the base is the total
            row += `${baseValue !== totalValue ? ` → ${totalValue >= 0 ? '+' : ''}${totalValue}` : ''}`;
        }
        // Append cost for base value (points spent on skills only)
        row += baseCost > 0 ? ` (${baseCost} pts)` : '';
        html += `<li>${row}</li>`;
    });
    html += '</ul>';
    html += '</div>';
    
    // Powers section
    if (character.powers.length > 0) {
        html += '<div class="summary-section">';
        html += '<h4>Powers</h4>';
        html += '<ul class="summary-list">';
        let hasGMPowers = false;
        character.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            // Determine any training modifiers that apply to this power.  Training targets can include
            // selected advanced powers, and modifiers are stored in the same structure as skills.
            const mods = (skillModifiers[power.id] || []);
            let modSum = 0;
            let modDetails = '';
            if (mods.length > 0) {
                const modStrings = mods.map(mod => {
                    modSum += mod.value;
                    return `${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.featureName} from ${mod.extraName})`;
                });
                modDetails = modStrings.join(', ');
            }
            if (['dominion', 'essence', 'song'].includes(power.id)) {
                const manualCost = gmPowerCosts[power.id];
                let line = `${powerName} (${manualCost || 'GM approval required'} pts)`;
                if (mods.length > 0) {
                    line += ` - ${modDetails} → +${modSum}`;
                }
                html += `<li>${line}</li>`;
                hasGMPowers = true;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName2, creditValue] = credit.split(':');
                        const hasPowerForCredit = character.powers.some(p => p.id === powerName2);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                // Build base line with cost
                let line = `${powerName} (${displayCost === 'Free' ? 'Free' : displayCost + ' pts'})`;
                // Append any training modifiers for this power
                if (mods.length > 0) {
                    line += ` - ${modDetails} → +${modSum}`;
                }
                html += `<li>${line}</li>`;
            }
        });
        html += '</ul>';
        if (character.powers.some(p => ['dominion', 'essence', 'song'].includes(p.id))) {
            html += '<p style="color: #EFBF04; font-style: italic;">Note: Ancient powers require GM approval and custom point costs.</p>';
        }
        html += '</div>';
    }
    
    // Extras section
    if (character.extras.length > 0) {
        html += '<div class="summary-section">';
        html += '<h4>Extras</h4>';
        html += '<ul class="summary-list">';
        character.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            // Start list item
            html += `<li>${extraName}${extraType}${costText}`;
            let detailLines = [];
            if (extra.isSimple && extra.simpleAspect) {
                detailLines.push(`Aspect: ${extra.simpleAspect}`);
            } else if (!extra.isSimple && extra.features.length > 0) {
                // Produce detailed descriptions per feature
                extra.features.forEach(feature => {
                    const fname = feature.name;
                    switch (fname) {
                        case 'Training':
                            if (feature.skill) {
                                const lvl = parseInt(feature.level) || 0;
                                if (lvl !== 0) {
                                    const skillDisplay = feature.skill
                                        .replace(/-/g, ' ')
                                        .replace(/\b\w/g, l => l.toUpperCase());
                                    detailLines.push(`Training: +${lvl} to ${skillDisplay}`);
                                }
                            }
                            break;
                        case 'Skilled':
                            if (Array.isArray(feature.skillMods) && feature.skillMods.length > 0) {
                                const mods = feature.skillMods.map(mod => {
                                    if (!mod.skill || mod.value === undefined || mod.value === null || isNaN(mod.value)) return null;
                                    const sname = mod.skill.charAt(0).toUpperCase() + mod.skill.slice(1);
                                    return `${sname} (${mod.value >= 0 ? '+' : ''}${mod.value})`;
                                }).filter(Boolean);
                                if (mods.length > 0) {
                                    detailLines.push(`Skilled: ${mods.join(', ')}`);
                                }
                            }
                            break;
                        case 'Focus':
                            if (feature.skill) {
                                const sname = feature.skill.charAt(0).toUpperCase() + feature.skill.slice(1);
                                const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                                detailLines.push(`Focus: +2 to ${sname}${when}`);
                            }
                            break;
                        case 'Flexible':
                            if (feature.skillUsed && feature.skillReplaced) {
                                const used = feature.skillUsed.charAt(0).toUpperCase() + feature.skillUsed.slice(1);
                                const repl = feature.skillReplaced.charAt(0).toUpperCase() + feature.skillReplaced.slice(1);
                                const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                                detailLines.push(`Flexible: Use ${used} for ${repl}${when}`);
                            }
                            break;
                        case 'Technique':
                            if (feature.ability) {
                                detailLines.push(`Technique: ${feature.ability}`);
                            }
                            break;
                        case 'Talented':
                        case 'Unusual':
                        case 'Primal Born':
                            if (feature.description) {
                                detailLines.push(`${fname}: ${feature.description}`);
                            }
                            break;
                        case 'Aspect':
                            // These extras add aspects; attempt to show description if present
                            if (feature.description) {
                                detailLines.push(`Aspect: ${feature.description}`);
                            }
                            break;
                        default:
                            // Generic catch-all description
                            if (feature.description) {
                                detailLines.push(`${fname}: ${feature.description}`);
                            }
                            break;
                    }
                });
                // If no descriptive lines were generated, fall back to listing feature names
                if (detailLines.length === 0) {
                    const names = extra.features.map(f => f.name).join(', ');
                    detailLines.push(`Features: ${names}`);
                }
            }
            // Append details to the list item
            if (detailLines.length > 0) {
                html += `<br><span style="margin-left: 15px; font-style: italic;">${detailLines.join('<br>')}</span>`;
            }
            html += `</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // Point allocation summary
    html += '<div class="summary-section">';
    html += '<h4>Point Allocation</h4>';
    html += '<ul class="summary-list">';
    html += `<li>Total Available: ${character.totalPoints}</li>`;
    if (character.heritagePoints !== 0) {
        html += `<li>Heritage Adjustment: ${character.heritagePoints > 0 ? '+' : ''}${character.heritagePoints}</li>`;
    }
    html += `<li>Used: ${character.usedPoints}</li>`;
    html += `<li>Good Stuff Rating: ${character.totalPoints - character.usedPoints}</li>`;
    html += '</ul>';
    html += '</div>';
    
    summaryDiv.innerHTML = html;
}

// Save/Load functionality
function saveCharacter() {
    try {
        // Persist current names into character state
        const charNameEl = document.getElementById('characterName');
        const playerNameEl = document.getElementById('playerName');
        if (charNameEl) character.characterName = charNameEl.value;
        if (playerNameEl) character.playerName = playerNameEl.value;
        
        const saveData = {
            ...character,
            concept: document.getElementById('concept').value,
            position: document.getElementById('position').value,
            trouble: document.getElementById('trouble').value,
            secret: document.getElementById('secret').value,
            gmPowerCosts: gmPowerCosts,
            formValues: {
                heritage: document.getElementById('heritage').value,
                skills: {},
                powers: {}
            },
            extraIdCounter: extraIdCounter,
            featureInstanceCounter: featureInstanceCounter
        };
        
        // Include names directly in saveData for easy retrieval
        saveData.characterName = character.characterName;
        saveData.playerName = character.playerName;
        
        const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
        skills.forEach(skill => {
            saveData.formValues.skills[skill] = document.getElementById(skill).value;
        });
        
        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        powerElements.forEach(element => {
            saveData.formValues.powers[element.id] = element.checked;
        });
        
        localStorage.setItem('amberCharacter', JSON.stringify(saveData));
        document.getElementById('saveStatus').textContent = 'Saved ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 2000);
    } catch (error) {
        console.error('Save failed:', error);
        document.getElementById('saveStatus').textContent = 'Save failed!';
    }
}

function loadCharacter() {
    try {
        const saved = localStorage.getItem('amberCharacter');
        if (!saved) return;
        
        const saveData = JSON.parse(saved);
        
        // Restore names
        if (saveData.characterName && document.getElementById('characterName')) {
            document.getElementById('characterName').value = saveData.characterName;
            character.characterName = saveData.characterName;
        }
        if (saveData.playerName && document.getElementById('playerName')) {
            document.getElementById('playerName').value = saveData.playerName;
            character.playerName = saveData.playerName;
        }
        
        if (saveData.concept) document.getElementById('concept').value = saveData.concept;
        if (saveData.position) document.getElementById('position').value = saveData.position;
        if (saveData.trouble) document.getElementById('trouble').value = saveData.trouble;
        if (saveData.secret) document.getElementById('secret').value = saveData.secret;
        
        if (saveData.gmPowerCosts) {
            gmPowerCosts = saveData.gmPowerCosts;
            // Restore GM power cost inputs
            Object.entries(gmPowerCosts).forEach(([powerId, cost]) => {
                const input = document.getElementById(powerId + '-manual-cost');
                if (input) input.value = cost;
            });
        }
        
        if (saveData.formValues && saveData.formValues.heritage) {
            document.getElementById('heritage').value = saveData.formValues.heritage;
            updateHeritage();
        }
        
        if (saveData.formValues && saveData.formValues.skills) {
            Object.entries(saveData.formValues.skills).forEach(([skill, value]) => {
                if (document.getElementById(skill)) {
                    document.getElementById(skill).value = value;
                }
            });
            updateSkills();
        }
        
        if (saveData.formValues && saveData.formValues.powers) {
            Object.entries(saveData.formValues.powers).forEach(([powerId, checked]) => {
                const element = document.getElementById(powerId);
                if (element) {
                    element.checked = checked;
                }
            });
            updatePowers();
        }
        
        if (saveData.extras) {
            character.extras = saveData.extras;
            extraIdCounter = saveData.extraIdCounter || 0;
            featureInstanceCounter = saveData.featureInstanceCounter || 0;
            
            document.getElementById('extrasContainer').innerHTML = '';
            
            character.extras.forEach(extra => {
                renderExtra(extra);
            });
        }
        
        document.getElementById('saveStatus').textContent = 'Loaded previous save ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 3000);
    } catch (error) {
        console.error('Load failed:', error);
        document.getElementById('saveStatus').textContent = 'Load failed!';
    }
}

function resetCharacter() {
    if (confirm('Are you sure you want to reset all character data? This cannot be undone.')) {
        localStorage.removeItem('amberCharacter');
        location.reload();
    }
}

function exportCharacter() {
    // Ensure names are up to date in character state
    if (document.getElementById('characterName')) character.characterName = document.getElementById('characterName').value;
    if (document.getElementById('playerName')) character.playerName = document.getElementById('playerName').value;
    
    const exportData = {
        ...character,
        concept: document.getElementById('concept').value,
        position: document.getElementById('position').value,
        trouble: document.getElementById('trouble').value,
        secret: document.getElementById('secret').value
    };
    
    let output = '=== ANCIENT SECRETS CHARACTER SHEET ===\n\n';
    output += `Character Name: ${exportData.characterName || ''}\n`;
    output += `Player Name: ${exportData.playerName || ''}\n`;
    {
        // Always display the heritage point adjustment, including zero, to make it explicit
        const heritageDisplay = exportData.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const hPts = exportData.heritagePoints;
        output += `Heritage: ${heritageDisplay} (${hPts > 0 ? '+' : ''}${hPts} pts)\n`;
    }
    output += `Concept: ${exportData.concept}\n`;
    output += `Position: ${exportData.position}\n`;
    output += `Trouble: ${exportData.trouble}\n`;
    output += `Secret: ${exportData.secret}\n\n`;
    
    output += '=== SKILLS ===\n';
    // Build a map of all skill modifiers from extras. This uses the same helper
    // used in the summary to aggregate modifiers across all extras. It
    // returns an object keyed by skill name with an array of modifier
    // objects (value, featureName, extraName).
    const skillModsForExport = getSkillModifiers();
    Object.entries(exportData.skills).forEach(([skill, value]) => {
        const skillNameCap = skill.charAt(0).toUpperCase() + skill.slice(1);
        // Base point cost for the skill (only points above 0 cost anything)
        const baseCost = Math.max(0, value);
        // Gather any modifiers for this skill
        const mods = skillModsForExport[skill] || [];
        let modTotal = 0;
        const modStrings = [];
        mods.forEach(mod => {
            modTotal += mod.value;
            modStrings.push(`${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.featureName} from ${mod.extraName})`);
        });
        const totalValue = value + modTotal;
        // Build line. Always include the base value. If modifiers exist,
        // include the list and the resulting total. Otherwise just show
        // the base value (which is also the total).
        let line = `${skillNameCap}: ${value >= 0 ? '+' : ''}${value}`;
        if (mods.length > 0) {
            line += `, ${modStrings.join(', ')} -> ${totalValue >= 0 ? '+' : ''}${totalValue}`;
        } else if (value !== totalValue) {
            // If base differs from total, show the total
            line += ` -> ${totalValue >= 0 ? '+' : ''}${totalValue}`;
        }
        // Append cost for the base skill value
        if (baseCost > 0) {
            line += ` (${baseCost} pts)`;
        }
        output += line + '\n';
    });
    
    if (exportData.powers.length > 0) {
        output += '\n=== POWERS ===\n';
        exportData.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            // Retrieve any training modifiers for this power from the aggregated skillMods map.
            const powerMods = (skillModsForExport[power.id] || []);
            let modTotal = 0;
            const modStrings = [];
            powerMods.forEach(mod => {
                modTotal += mod.value;
                modStrings.push(`${mod.value >= 0 ? '+' : ''}${mod.value} (${mod.featureName} from ${mod.extraName})`);
            });
            const modSummary = powerMods.length > 0 ? `${modStrings.join(', ')} -> +${modTotal}` : '';
            if (['dominion', 'essence', 'song'].includes(power.id)) {
                const manualCost = gmPowerCosts[power.id];
                output += `${powerName} (${manualCost || 'GM approval required'} pts)`;
                if (modSummary) {
                    output += ` - ${modSummary}`;
                }
                output += `\n`;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName2, creditValue] = credit.split(':');
                        const hasPowerForCredit = exportData.powers.some(p => p.id === powerName2);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                output += `${powerName} (${displayCost === 'Free' ? 'Free' : displayCost + ' pts'})`;
                if (modSummary) {
                    output += ` - ${modSummary}`;
                }
                output += `\n`;
            }
        });
    }
    
    if (exportData.extras.length > 0) {
        output += '\n=== EXTRAS ===\n';
        exportData.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            
            output += `${extraName}${extraType}${costText}\n`;
            
            if (extra.isSimple && extra.simpleAspect) {
                output += `  Aspect: ${extra.simpleAspect}\n`;
            } else if (!extra.isSimple && extra.features.length > 0) {
                extra.features.forEach(feature => {
                    // Begin line with feature name
                    let line = `  ${feature.name}`;
                    const fname = feature.name;
                    switch (fname) {
                        case 'Training':
                            if (feature.skill) {
                                const lvl = parseInt(feature.level) || 0;
                                // Display advanced power names with spaces and capital letters
                                const skillDisplay = feature.skill
                                    .replace(/-/g, ' ')
                                    .replace(/\b\w/g, l => l.toUpperCase());
                                line += `: +${lvl} to ${skillDisplay}`;
                            }
                            break;
                        case 'Skilled':
                            if (Array.isArray(feature.skillMods) && feature.skillMods.length > 0) {
                                const mods = feature.skillMods.map(sm => `${sm.skill}(${sm.value >= 0 ? '+' : ''}${sm.value})`).join(', ');
                                line += `: ${mods}`;
                            }
                            break;
                        case 'Focus':
                            if (feature.skill) {
                                const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                                line += `: +2 to ${feature.skill}${when}`;
                            }
                            break;
                        case 'Flexible':
                            if (feature.skillUsed && feature.skillReplaced) {
                                const when = feature.circumstance ? ` when ${feature.circumstance}` : '';
                                line += `: Use ${feature.skillUsed} for ${feature.skillReplaced}${when}`;
                            }
                            break;
                        case 'Technique':
                            if (feature.ability) {
                                line += `: ${feature.ability}`;
                            }
                            break;
                        case 'Talented':
                        case 'Unusual':
                        case 'Primal Born':
                            if (feature.description) {
                                line += `: ${feature.description}`;
                            }
                            break;
                        default:
                            if (feature.description) {
                                line += `: ${feature.description}`;
                            }
                            break;
                    }
                    output += line + '\n';
                });
            }
        });
    }
    
    output += `\n=== POINT SUMMARY ===\n`;
    output += `Total Available: ${exportData.totalPoints}\n`;
    // Always include the heritage adjustment in the point summary, even when zero
    output += `Heritage Adjustment: ${exportData.heritagePoints > 0 ? '+' : ''}${exportData.heritagePoints}\n`;
    output += `Used: ${exportData.usedPoints}\n`;
    output += `Good Stuff Rating: ${exportData.totalPoints - exportData.usedPoints}\n`;
    
    // Create downloadable file with dynamic naming
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `Ancient Secrets - ${exportData.characterName || 'Character'} (${exportData.playerName || 'Player'}).txt`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function testLocalStorage() {
    // Test saving and loading functionality
    console.log('Testing localStorage functionality...');
    
    try {
        // Test basic save
        const testData = { test: 'data', timestamp: Date.now() };
        localStorage.setItem('test_amber_save', JSON.stringify(testData));
        
        // Test basic load
        const loaded = JSON.parse(localStorage.getItem('test_amber_save'));
        console.log('Basic save/load test:', loaded.test === 'data' ? 'PASSED' : 'FAILED');
        
        // Test character save
        saveCharacter();
        console.log('Character save test: PASSED');
        
        // Test character load
        const characterData = localStorage.getItem('amberCharacter');
        if (characterData) {
            const parsed = JSON.parse(characterData);
            console.log('Character load test:', parsed ? 'PASSED' : 'FAILED');
            console.log('Extras in save data:', parsed.extras ? parsed.extras.length : 0);
        } else {
            console.log('Character load test: FAILED - No data found');
        }
        
        // Clean up test data
        localStorage.removeItem('test_amber_save');
        
        alert('localStorage test completed. Check console for results.');
        
    } catch (error) {
        console.error('localStorage test failed:', error);
        alert('localStorage test failed: ' + error.message);
    }
}

// Initialize and set up auto-save
document.addEventListener('DOMContentLoaded', function() {
    loadCharacter();
    updatePointsDisplay();
    
    // Add event listeners for text inputs including new name fields
    const textInputs = ['characterName', 'playerName', 'concept', 'position', 'trouble', 'secret'];
    textInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', saveCharacter);
            element.addEventListener('blur', saveCharacter);
        }
    });
    
    // Set up auto-save for GM power costs
    const gmPowerIds = ['dominion', 'essence', 'song'];
    gmPowerIds.forEach(powerId => {
        const input = document.getElementById(powerId + '-manual-cost');
        if (input) {
            input.addEventListener('change', () => updateGMPowerCost(powerId));
        }
    });
});