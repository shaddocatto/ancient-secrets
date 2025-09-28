let character = {
    heritage: '',
    concept: '',
    position: '',
    trouble: '',
    goal: '',
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
    usedPoints: 0
};

let extraIdCounter = 0;
let featureInstanceCounter = 0;

// Extras management
function addExtra() {
    const extraId = 'extra_' + (++extraIdCounter);
    const extra = {
        id: extraId,
        name: '',
        type: '',
        isSimple: true,
        simpleAspects: [], // Changed to array to allow multiple aspects
        features: [],
        isEditing: true // Start in edit mode for new extras
    };
    
    character.extras.push(extra);
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter(); // Ensure saving happens
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
                Simple (Name + Aspects + Invokes)
            </label>
            <label>
                <input type="radio" name="${extra.id}_simple" value="false" ${!extra.isSimple ? 'checked' : ''} onchange="updateExtraMode('${extra.id}', false)">
                Custom (Detailed Features)
            </label>
        </div>
        
        <div id="${extra.id}_simple_options" style="display: ${extra.isSimple ? 'block' : 'none'};">
            ${renderSimpleAspects(extra)}
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

function renderSimpleAspects(extra) {
    if (!extra.simpleAspects) extra.simpleAspects = [];
    
    let html = '<div class="form-group"><label>Aspects:</label>';
    
    extra.simpleAspects.forEach((aspect, index) => {
        html += `
            <div style="display: flex; gap: 10px; margin: 5px 0;">
                <input type="text" value="${aspect}" placeholder="e.g., Swift as the Wind, Unbreakable Bond" 
                       onchange="updateSimpleAspect('${extra.id}', ${index}, this.value)" style="flex: 1;">
                <button type="button" class="remove-instance-btn" onclick="removeSimpleAspect('${extra.id}', ${index})">×</button>
            </div>
        `;
    });
    
    html += `<button type="button" class="add-instance-btn" onclick="addSimpleAspect('${extra.id}')" style="margin-top: 5px;">Add Aspect (${getAspectCost(extra.type)} pts each)</button>`;
    html += '</div>';
    
    return html;
}

function addSimpleAspect(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    if (!extra.simpleAspects) extra.simpleAspects = [];
    extra.simpleAspects.push('');
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
}

function removeSimpleAspect(extraId, index) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.simpleAspects.splice(index, 1);
    renderExtra(extra);
    updatePointsDisplay();
    saveCharacter();
}

function updateSimpleAspect(extraId, index, value) {
    const extra = character.extras.find(e => e.id === extraId);
    extra.simpleAspects[index] = value;
    saveCharacter();
}

function getAspectCost(type) {
    switch(type) {
        case 'domain': return 0.25;
        case 'ally':
        case 'item':
        case 'mastery':
        default: return 0.5;
    }
}

function renderExtraDisplayMode(extra) {
    const extraName = extra.name || 'Unnamed Extra';
    const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
    const extraCost = calculateExtraCost(extra);
    const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
    
    let details = '';
    
    if (extra.isSimple && extra.simpleAspects && extra.simpleAspects.length > 0) {
        const validAspects = extra.simpleAspects.filter(a => a.trim() !== '');
        if (validAspects.length > 0) {
            details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">Aspects: ${validAspects.join(', ')}</div>`;
        }
    } else if (!extra.isSimple && extra.features.length > 0) {
        const featureGroups = {};
        extra.features.forEach(f => {
            if (!featureGroups[f.name]) featureGroups[f.name] = [];
            featureGroups[f.name].push(f);
        });
        
        const featureDetails = Object.entries(featureGroups).map(([name, instances]) => {
            if (instances.length === 1) {
                const instance = instances[0];
                if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                    const whenText = instance.circumstance ? ` when ${instance.circumstance}` : '';
                    return `${name}: Use ${instance.skillUsed} in place of ${instance.skillReplaced}${whenText}`;
                } else if (name === 'Focus' && instance.skill) {
                    const whenText = instance.circumstance ? ` when ${instance.circumstance}` : '';
                    return `${name}: +2 to ${instance.skill}${whenText}`;
                } else if (name === 'Skilled' && instance.skillMods && instance.skillMods.length > 0) {
                    const skillList = instance.skillMods.map(sm => `${sm.skill}(${sm.value >= 0 ? '+' : ''}${sm.value})`).join(', ');
                    return `${name}: ${skillList}`;
                } else if (instance.description) {
                    return `${name}: ${instance.description}`;
                } else if (instance.ability) {
                    return `${name}: ${instance.ability}`;
                } else {
                    return name;
                }
            } else {
                return `${name} (×${instances.length})`;
            }
        }).join('<br>');
        
        details = `<div style="margin: 10px 0; color: #cccccc; font-style: italic;">${featureDetails}</div>`;
        
        // Add skill modifiers summary if any exist
        const allSkillMods = [];
        extra.features.forEach(feature => {
            if (feature.skillMods && feature.skillMods.length > 0) {
                feature.skillMods.forEach(skillMod => {
                    if (skillMod.skill && skillMod.value !== undefined) {
                        allSkillMods.push(skillMod);
                    }
                });
            }
        });
        
        if (allSkillMods.length > 0) {
            const skillModSummary = allSkillMods.map(sm => 
                `${sm.skill.charAt(0).toUpperCase() + sm.skill.slice(1)} ${sm.value >= 0 ? '+' : ''}${sm.value}`
            ).join(', ');
            details += `<div style="margin: 10px 0; padding: 8px; background: rgba(239, 191, 4, 0.1); border-left: 3px solid #EFBF04; border-radius: 3px;">
                <strong style="color: #EFBF04;">Skill Modifiers:</strong> ${skillModSummary}
            </div>`;
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
        
        let costDisplay;
        if (feature.gmCost) {
            costDisplay = 'GM';
        } else {
            costDisplay = feature.cost === 0 ? 'Free' : feature.cost;
        }
        
        html += `
            <div class="power-item ${disabledClass}" id="${extra.id}_feature_${feature.name.replace(/\s+/g, '_')}">
                <label>
                    <input type="checkbox" ${hasInstances ? 'checked' : ''} ${disabled} 
                           onchange="toggleExtraFeature('${extra.id}', '${feature.name}', ${feature.cost}, '${feature.required || ''}', ${feature.gmCost || false})">
                    <span class="power-cost">${costDisplay}</span>
                    ${feature.name}
                    ${feature.gmCost ? ' (GM Approval Required)' : ''}
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
            <div class="feature-instance" id="${extraId}_${featureName.replace(/\s+/g, '_')}_instance_${index}">
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
    let content = '';
    
    switch(featureName) {
        case 'Skilled':
            content = `
                <div class="form-group">
                    <label>Skills to Modify:</label>
                    <div id="${extraId}_${featureName.replace(/\s+/g, '_')}_skills_${index}">
                        ${renderSkillModifications(extraId, featureName, instance, index)}
                    </div>
                    <button type="button" class="add-instance-btn" onclick="addSkillModification('${extraId}', '${featureName}', ${index})" style="font-size: 0.7em; padding: 3px 6px;">Add Skill</button>
                </div>
            `;
            break;
            
        case 'Exceptional':
            content = `
                <div class="form-group">
                    <label>How does this break the rules?</label>
                    <textarea 
                        id="${extraId}_${featureName.replace(/\s+/g, '_')}_desc_${index}"
                        placeholder="Describe exactly how this exceptional ability breaks the normal rules once per session..."
                        onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                        style="width: 100%; height: 60px; resize: vertical;"
                    >${instance.description || ''}</textarea>
                </div>
            `;
            break;
            
        case 'Flexible':
            content = `
                <div class="form-group">
                    <label>Use <select onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'skillUsed', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                        <option value="">skill</option>
                        <option value="strength" ${instance.skillUsed === 'strength' ? 'selected' : ''}>Strength</option>
                        <option value="warfare" ${instance.skillUsed === 'warfare' ? 'selected' : ''}>Warfare</option>
                        <option value="psyche" ${instance.skillUsed === 'psyche' ? 'selected' : ''}>Psyche</option>
                        <option value="endurance" ${instance.skillUsed === 'endurance' ? 'selected' : ''}>Endurance</option>
                        <option value="status" ${instance.skillUsed === 'status' ? 'selected' : ''}>Status</option>
                        <option value="intrigue" ${instance.skillUsed === 'intrigue' ? 'selected' : ''}>Intrigue</option>
                        <option value="hunting" ${instance.skillUsed === 'hunting' ? 'selected' : ''}>Hunting</option>
                        <option value="lore" ${instance.skillUsed === 'lore' ? 'selected' : ''}>Lore</option>
                    </select> in place of <select onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'skillReplaced', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                        <option value="">skill</option>
                        <option value="strength" ${instance.skillReplaced === 'strength' ? 'selected' : ''}>Strength</option>
                        <option value="warfare" ${instance.skillReplaced === 'warfare' ? 'selected' : ''}>Warfare</option>
                        <option value="psyche" ${instance.skillReplaced === 'psyche' ? 'selected' : ''}>Psyche</option>
                        <option value="endurance" ${instance.skillReplaced === 'endurance' ? 'selected' : ''}>Endurance</option>
                        <option value="status" ${instance.skillReplaced === 'status' ? 'selected' : ''}>Status</option>
                        <option value="intrigue" ${instance.skillReplaced === 'intrigue' ? 'selected' : ''}>Intrigue</option>
                        <option value="hunting" ${instance.skillReplaced === 'hunting' ? 'selected' : ''}>Hunting</option>
                        <option value="lore" ${instance.skillReplaced === 'lore' ? 'selected' : ''}>Lore</option>
                    </select> when:</label>
                    <input type="text" 
                           placeholder="e.g., researching ancient families"
                           value="${instance.circumstance || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)"
                           style="width: 100%; margin-top: 5px;">
                </div>
            `;
            break;
            
        case 'Focus':
            content = `
                <div class="form-group">
                    <label>+2 to <select onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'skill', this.value)" style="display: inline; width: auto; margin: 0 5px;">
                        <option value="">skill</option>
                        <option value="strength" ${instance.skill === 'strength' ? 'selected' : ''}>Strength</option>
                        <option value="warfare" ${instance.skill === 'warfare' ? 'selected' : ''}>Warfare</option>
                        <option value="psyche" ${instance.skill === 'psyche' ? 'selected' : ''}>Psyche</option>
                        <option value="endurance" ${instance.skill === 'endurance' ? 'selected' : ''}>Endurance</option>
                        <option value="status" ${instance.skill === 'status' ? 'selected' : ''}>Status</option>
                        <option value="intrigue" ${instance.skill === 'intrigue' ? 'selected' : ''}>Intrigue</option>
                        <option value="hunting" ${instance.skill === 'hunting' ? 'selected' : ''}>Hunting</option>
                        <option value="lore" ${instance.skill === 'lore' ? 'selected' : ''}>Lore</option>
                    </select> when:</label>
                    <input type="text" 
                           placeholder="e.g., fighting in your home domain"
                           value="${instance.circumstance || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'circumstance', this.value)"
                           style="width: 100%; margin-top: 5px;">
                </div>
            `;
            break;
            
        case 'Technique':
            content = `
                <div class="form-group">
                    <label>Power Ability:</label>
                    <input type="text" 
                           placeholder="e.g., Trump Defense from Trump Artist"
                           value="${instance.ability || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'ability', this.value)"
                           style="width: 100%;">
                </div>
            `;
            break;
            
        case 'Bound':
            content = `
                <div class="form-group">
                    <label>Bound Details:</label>
                    <input type="text" 
                           placeholder="e.g., telepathic link, shared senses"
                           value="${instance.description || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                           style="width: 100%;">
                </div>
            `;
            break;
            
        case 'Talented':
            content = `
                <div class="form-group">
                    <label>Unique Skill Name:</label>
                    <input type="text" 
                           placeholder="e.g., Shadow Manipulation, Quantum Physics"
                           value="${instance.skillName || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'skillName', this.value)"
                           style="width: 100%; margin-bottom: 5px;">
                    <label>Skill Description:</label>
                    <textarea 
                        placeholder="Describe what this unique skill allows..."
                        onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                        style="width: 100%; height: 60px; resize: vertical;"
                    >${instance.description || ''}</textarea>
                    <label>Points Spent:</label>
                    <input type="number" min="1" max="20" 
                           value="${instance.pointsSpent || 1}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'pointsSpent', parseInt(this.value))"
                           style="width: 100px;">
                </div>
            `;
            break;
            
        case 'Training':
            content = `
                <div class="form-group">
                    <label>Skill/Power to Improve:</label>
                    <input type="text" 
                           placeholder="e.g., Advanced Pattern Adept, Unique Skill Name"
                           value="${instance.skillName || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'skillName', this.value)"
                           style="width: 100%; margin-bottom: 5px;">
                    <label>Improvement (+1 per point):</label>
                    <input type="number" min="1" max="12" 
                           value="${instance.improvement || 1}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'improvement', parseInt(this.value))"
                           style="width: 100px;">
                </div>
            `;
            break;
            
        case 'Primal Born':
            content = `
                <div class="form-group">
                    <label>Ancient Heritage Details:</label>
                    <textarea 
                        placeholder="Describe your activated Ancient Heritage..."
                        onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                        style="width: 100%; height: 60px; resize: vertical;"
                    >${instance.description || ''}</textarea>
                    <label>Points Spent (GM Approval):</label>
                    <input type="number" min="1" max="20" 
                           value="${instance.pointsSpent || 1}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'pointsSpent', parseInt(this.value))"
                           style="width: 100px;">
                </div>
            `;
            break;
            
        case 'Unusual':
            content = `
                <div class="form-group">
                    <label>Unusual Feature Name:</label>
                    <input type="text" 
                           placeholder="e.g., Phase Shifting, Time Dilation"
                           value="${instance.featureName || ''}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'featureName', this.value)"
                           style="width: 100%; margin-bottom: 5px;">
                    <label>Feature Description:</label>
                    <textarea 
                        placeholder="Describe this unusual feature..."
                        onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                        style="width: 100%; height: 60px; resize: vertical;"
                    >${instance.description || ''}</textarea>
                    <label>Points Spent (GM Approval):</label>
                    <input type="number" min="1" max="20" 
                           value="${instance.pointsSpent || 1}"
                           onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'pointsSpent', parseInt(this.value))"
                           style="width: 100px;">
                </div>
            `;
            break;
            
        default:
            if (instance.description !== undefined) {
                content = `
                    <div class="form-group">
                        <label>Notes:</label>
                        <input type="text" 
                               placeholder="Additional details..."
                               value="${instance.description || ''}"
                               onchange="updateFeatureInstanceData('${extraId}', '${featureName}', ${index}, 'description', this.value)"
                               style="width: 100%;">
                    </div>
                `;
            }
            break;
    }
    
    return content;
}

function renderSkillModifications(extraId, featureName, instance, instanceIndex) {
    if (!instance.skillMods) instance.skillMods = [];
    
    let html = '';
    instance.skillMods.forEach((skillMod, skillIndex) => {
        html += `
            <div class="skill-selection" style="margin-bottom: 5px;">
                <select onchange="updateSkillModification('${extraId}', '${featureName}', ${instanceIndex}, ${skillIndex}, 'skill', this.value)">
                    <option value="">Select Skill...</option>
                    <option value="strength" ${skillMod.skill === 'strength' ? 'selected' : ''}>Strength</option>
                    <option value="warfare" ${skillMod.skill === 'warfare' ? 'selected' : ''}>Warfare</option>
                    <option value="psyche" ${skillMod.skill === 'psyche' ? 'selected' : ''}>Psyche</option>
                    <option value="endurance" ${skillMod.skill === 'endurance' ? 'selected' : ''}>Endurance</option>
                    <option value="status" ${skillMod.skill === 'status' ? 'selected' : ''}>Status</option>
                    <option value="intrigue" ${skillMod.skill === 'intrigue' ? 'selected' : ''}>Intrigue</option>
                    <option value="hunting" ${skillMod.skill === 'hunting' ? 'selected' : ''}>Hunting</option>
                    <option value="lore" ${skillMod.skill === 'lore' ? 'selected' : ''}>Lore</option>
                </select>
                <input type="number" min="-3" max="12" value="${skillMod.value || 0}" 
                       onchange="updateSkillModification('${extraId}', '${featureName}', ${instanceIndex}, ${skillIndex}, 'value', this.value)"
                       placeholder="Value">
                <button type="button" class="remove-instance-btn" onclick="removeSkillModification('${extraId}', '${featureName}', ${instanceIndex}, ${skillIndex})">×</button>
            </div>
        `;
    });
    
    return html;
}

function addSkillModification(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance) return; // Safety check
    
    if (!instance.skillMods) instance.skillMods = [];
    instance.skillMods.push({ skill: '', value: 0 });
    
    // Re-render the custom options
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    saveCharacter();
}

function removeSkillModification(extraId, featureName, instanceIndex, skillIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance) return; // Safety check
    
    instance.skillMods.splice(skillIndex, 1);
    
    // Re-render the custom options
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    saveCharacter();
}

function updateSkillModification(extraId, featureName, instanceIndex, skillIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (!instance) return; // Safety check
    
    if (!instance.skillMods) instance.skillMods = [];
    if (!instance.skillMods[skillIndex]) instance.skillMods[skillIndex] = {};
    
    instance.skillMods[skillIndex][field] = field === 'value' ? parseInt(value) : value;
    
    saveCharacter();
}

function addFeatureInstance(extraId, featureName) {
    const extra = character.extras.find(e => e.id === extraId);
    const feature = getAvailableFeatures(extra.type).find(f => f.name === featureName);
    
    const newInstance = {
        name: featureName,
        cost: feature.cost,
        gmCost: feature.gmCost,
        instanceIndex: featureInstanceCounter++
    };
    
    // Initialize specific data based on feature type
    switch(featureName) {
        case 'Skilled':
            newInstance.skillMods = [];
            break;
        case 'Exceptional':
        case 'Technique':
        case 'Bound':
            newInstance.description = '';
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
        case 'Talented':
            newInstance.skillName = '';
            newInstance.description = '';
            newInstance.pointsSpent = 1;
            break;
        case 'Training':
            newInstance.skillName = '';
            newInstance.improvement = 1;
            break;
        case 'Primal Born':
            newInstance.description = '';
            newInstance.pointsSpent = 1;
            break;
        case 'Unusual':
            newInstance.featureName = '';
            newInstance.description = '';
            newInstance.pointsSpent = 1;
            break;
    }
    
    extra.features.push(newInstance);
    
    // Re-render the custom options
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    // Update cost display
    const costDiv = document.querySelector(`#${extraId} .skill-cost`);
    costDiv.innerHTML = `<strong>Total Cost: ${calculateExtraCost(extra)} points</strong>`;
    
    updatePointsDisplay();
    saveCharacter();
}

function removeFeatureInstance(extraId, featureName, instanceIndex) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        // Remove the specific instance
        const indexToRemove = extra.features.findIndex(f => f.name === featureName && instances.indexOf(f) === instanceIndex);
        if (indexToRemove >= 0) {
            extra.features.splice(indexToRemove, 1);
        }
        
        // If no instances left, uncheck the feature
        const remainingInstances = extra.features.filter(f => f.name === featureName);
        if (remainingInstances.length === 0) {
            const checkbox = document.querySelector(`#${extraId}_feature_${featureName.replace(/\s+/g, '_')} input[type="checkbox"]`);
            if (checkbox) checkbox.checked = false;
        }
        
        // Re-render the custom options
        const customDiv = document.getElementById(extraId + '_custom_options');
        customDiv.innerHTML = renderCustomOptions(extra);
        
        // Update cost display
        const costDiv = document.querySelector(`#${extraId} .skill-cost`);
        costDiv.innerHTML = `<strong>Total Cost: ${calculateExtraCost(extra)} points</strong>`;
        
        updatePointsDisplay();
        saveCharacter();
    }
}

function updateFeatureInstanceData(extraId, featureName, instanceIndex, field, value) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    const instance = instances[instanceIndex];
    
    if (instance) {
        instance[field] = value;
        
        // Update cost display if this affects cost
        if (['pointsSpent', 'improvement'].includes(field)) {
            const costDiv = document.querySelector(`#${extraId} .skill-cost`);
            costDiv.innerHTML = `<strong>Total Cost: ${calculateExtraCost(extra)} points</strong>`;
            updatePointsDisplay();
        }
        
        saveCharacter();
    }
}

function getAvailableFeatures(type) {
    const features = {
        ally: [
            { name: 'Base Cost', cost: 0.5, required: '', description: 'REQUIRED FIRST. Ally starts with an Aspect, one Skill at Amber (0), another at Chaos (-1), and 2 mild stress boxes.', gmCost: false },
            { name: 'Organization', cost: 1, required: 'Base Cost', description: 'Has many members. Ability to affect things at scale. Start with one face (named member).', gmCost: false },
            { name: 'Aspect', cost: 0.5, required: 'Base Cost', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.', gmCost: false },
            { name: 'Bound', cost: 1, required: 'Base Cost', description: 'May use Ally\'s senses, Skills, or Powers (w/ concentration)', gmCost: false },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -1, required: 'Base Cost', description: 'Add GM chosen Aspect and/or Bad Stuff, get 1 point back. This may be applied twice if needed.', gmCost: false },
            { name: 'Resolute', cost: 0.25, required: 'Base Cost', description: 'Gives Ally +1 to psychic defense.', gmCost: false },
            { name: 'Skilled', cost: 0.5, required: 'Base Cost', description: 'Additional Amber and Chaos skill plus 3 points to buy Skills, Powers, etc.', gmCost: false },
            { name: 'Sturdy', cost: 0.25, required: 'Base Cost', description: 'Add one mild stress box. If bought thrice, may add moderate boxes.', gmCost: false },
            { name: 'Unusual', cost: 0, required: 'Base Cost', description: 'Add a Feature not covered above.', gmCost: true }
        ],
        domain: [
            { name: 'Aspect', cost: 0.25, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.', gmCost: false },
            { name: 'Barrier', cost: 0.25, required: '', description: 'Each time purchased blocks one Power from Domain.', gmCost: false },
            { name: 'Control', cost: 0.25, required: '', description: 'Each time purchased gives +1 to control Domain.', gmCost: false },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -0.5, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 0.5 points back. This may be applied twice if needed.', gmCost: false },
            { name: 'Exceptional', cost: 0.5, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.', gmCost: false },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].', gmCost: false },
            { name: 'Focus', cost: 0.5, required: '', description: '+2 to a Skill when [describe circumstance].', gmCost: false },
            { name: 'Security', cost: 0.25, required: '', description: 'Each purchase gives +1 to secure Domain.', gmCost: false },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above.', gmCost: true }
        ],
        item: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.', gmCost: false },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -0.5, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 0.5 points back. This may be applied twice if needed.', gmCost: false },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.', gmCost: false },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].', gmCost: false },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].', gmCost: false },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.', gmCost: false },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.', gmCost: false },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above.', gmCost: true }
        ],
        mastery: [
            { name: 'Aspect', cost: 0.5, required: '', description: 'Add one Aspect or one free Invoke to existing Aspect. Max of two free invokes per Aspect.', gmCost: false },
            { name: 'Cursed, Risky, or Uncontrolled', cost: -0.5, required: '', description: 'Add GM chosen Aspect and/or Bad Stuff, get 0.5 points back. This may be applied twice if needed.', gmCost: false },
            { name: 'Dominant', cost: 4, required: '', description: 'Choose one Skill to increase scale from Superior to Paragon. Only one Skill allowed.', gmCost: false },
            { name: 'Exceptional', cost: 1, required: '', description: 'Once per session, break the rules. May repeat by spending Good Stuff with GM approval.', gmCost: false },
            { name: 'Flexible', cost: 0.5, required: '', description: 'Use one Skill in place of another when [describe circumstance].', gmCost: false },
            { name: 'Focus', cost: 1, required: '', description: '+2 to a Skill when [describe circumstance].', gmCost: false },
            { name: 'Harmful', cost: 0.5, required: '', description: 'Do additional shift of harm for damage type or with Skill/Power if attack succeeds.', gmCost: false },
            { name: 'Immortal', cost: 1, required: '', description: 'Will recover from most any damage over time.', gmCost: false },
            { name: 'Incandescent', cost: 1, required: '', description: 'Lose all Power initiations, immune to Unmaking.', gmCost: false },
            { name: 'Primal Born', cost: 0, required: 'Incandescent,Immortal', description: 'Requires Incandescent and Immortal, you have integrated and activated Ancient Heritage.', gmCost: true },
            { name: 'Protective', cost: 1, required: '', description: 'Reduces successful attack by one shift for damage type. If reduced to <1, attacker gets boost.', gmCost: false },
            { name: 'Talented', cost: 0, required: '', description: 'Design a unique skill with custom abilities.', gmCost: true },
            { name: 'Technique', cost: 0.5, required: '', description: 'Add one ability from a Power. If full Power acquired later, this refunds back.', gmCost: false },
            { name: 'Training', cost: 1, required: '', description: 'Improve Advanced Power or Unique Skill (1 point per +1 to Skill).', gmCost: false },
            { name: 'Unusual', cost: 0, required: '', description: 'Add a Feature not covered above.', gmCost: true }
        ]
    };
    
    return features[type] || [];
}

function updateExtraName(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const nameInput = document.getElementById(extraId + '_name');
    extra.name = nameInput.value;
    
    // Update the header
    const header = document.querySelector(`#${extraId} h3`);
    header.textContent = `Extra: ${extra.name || 'Unnamed'}`;
    
    saveCharacter();
}

function updateExtraType(extraId) {
    const extra = character.extras.find(e => e.id === extraId);
    const typeSelect = document.getElementById(extraId + '_type');
    extra.type = typeSelect.value;
    extra.features = []; // Reset features when type changes
    
    // Re-render the custom options
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    // Update simple options
    if (extra.isSimple) {
        const simpleDiv = document.getElementById(extraId + '_simple_options');
        simpleDiv.innerHTML = renderSimpleAspects(extra) + `
            <div class="heritage-info">
                <strong>Simple Extras:</strong> ${getSimpleInvokes(extra.type)} invoke(s) per point spent. Invokes reset at milestones.
            </div>
        `;
    }
    
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

function toggleExtraFeature(extraId, featureName, cost, required, gmCost) {
    const extra = character.extras.find(e => e.id === extraId);
    const instances = extra.features.filter(f => f.name === featureName);
    
    if (instances.length > 0) {
        // Remove all instances of this feature
        extra.features = extra.features.filter(f => f.name !== featureName);
    } else {
        // Check prerequisites for Primal Born
        if (featureName === 'Primal Born') {
            const hasIncandescent = extra.features.some(f => f.name === 'Incandescent');
            const hasImmortal = extra.features.some(f => f.name === 'Immortal');
            if (!hasIncandescent || !hasImmortal) {
                alert('Primal Born requires both Incandescent and Immortal features.');
                // Uncheck the checkbox
                const checkbox = document.querySelector(`#${extraId}_feature_${featureName.replace(/\s+/g, '_')} input[type="checkbox"]`);
                if (checkbox) checkbox.checked = false;
                return;
            }
        }
        
        // Add first instance of this feature
        const newInstance = {
            name: featureName,
            cost: cost,
            gmCost: gmCost,
            instanceIndex: featureInstanceCounter++
        };
        
        // Initialize specific data based on feature type
        switch(featureName) {
            case 'Skilled':
                newInstance.skillMods = [];
                break;
            case 'Exceptional':
            case 'Technique':
            case 'Bound':
                newInstance.description = '';
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
            case 'Talented':
                newInstance.skillName = '';
                newInstance.description = '';
                newInstance.pointsSpent = 1;
                break;
            case 'Training':
                newInstance.skillName = '';
                newInstance.improvement = 1;
                break;
            case 'Primal Born':
                newInstance.description = '';
                newInstance.pointsSpent = 1;
                break;
            case 'Unusual':
                newInstance.featureName = '';
                newInstance.description = '';
                newInstance.pointsSpent = 1;
                break;
        }
        
        extra.features.push(newInstance);
    }
    
    // Re-render to update disabled states
    const customDiv = document.getElementById(extraId + '_custom_options');
    customDiv.innerHTML = renderCustomOptions(extra);
    
    // Update cost display
    const costDiv = document.querySelector(`#${extraId} .skill-cost`);
    costDiv.innerHTML = `<strong>Total Cost: ${calculateExtraCost(extra)} points</strong>`;
    
    updatePointsDisplay();
    saveCharacter();
}

function calculateExtraCost(extra) {
    if (!extra.type) return 0;
    
    if (extra.isSimple) {
        // Simple extras: 1 point base + aspect costs
        let cost = 1;
        if (extra.simpleAspects && extra.simpleAspects.length > 0) {
            const validAspects = extra.simpleAspects.filter(a => a.trim() !== '');
            cost += validAspects.length * getAspectCost(extra.type);
        }
        return cost;
    } else {
        // Custom extras: sum of all features
        return extra.features.reduce((total, feature) => {
            let featureCost = feature.cost;
            
            // Handle variable costs
            if (feature.gmCost && ['Talented', 'Training', 'Primal Born', 'Unusual'].includes(feature.name)) {
                if (feature.name === 'Training') {
                    featureCost = feature.improvement || 1;
                } else {
                    featureCost = feature.pointsSpent || 1;
                }
            }
            
            return total + featureCost;
        }, 0);
    }
}

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
    
    if (heritageDescription) {
        heritageInfo.innerHTML = heritageDescription;
        heritageInfo.style.display = 'block';
    } else {
        heritageInfo.style.display = 'none';
    }
    
    character.totalPoints = 60 + heritagePoints;
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

// Powers management
function updatePowers() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    character.powers = [];
    
    powerElements.forEach(element => {
        if (element.checked) {
            character.powers.push({
                id: element.id,
                cost: parseInt(element.dataset.cost),
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

// Points calculation
function calculateUsedPoints() {
    let total = 0;
    
    // Calculate skill costs
    Object.values(character.skills).forEach(value => {
        total += Math.max(0, value);
    });
    
    // Calculate power costs with heritage discounts and credits
    character.powers.forEach(power => {
        // Skip Ancient powers (GM determined cost)
        if (['dominion', 'essence', 'song'].includes(power.id)) {
            return;
        }
        
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
                        powerCost += parseInt(creditValue); // creditValue is already negative
                    }
                });
            }
        }
        
        total += Math.max(0, powerCost); // Don't allow negative costs
    });
    
    // Calculate extras costs
    character.extras.forEach(extra => {
        total += calculateExtraCost(extra);
    });
    
    return total;
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
    
    let summary = '<h3>Character Overview</h3>';
    
    if (character.heritage) {
        summary += `<p><strong>Heritage:</strong> ${character.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>`;
    }
    
    // Skills summary
    summary += '<h4>Skills</h4>';
    Object.entries(character.skills).forEach(([skill, value]) => {
        if (value !== 0) {
            summary += `<p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}:</strong> ${value >= 0 ? '+' : ''}${value}</p>`;
        }
    });
    
    // Powers summary
    if (character.powers.length > 0) {
        summary += '<h4>Powers</h4>';
        let hasAncientPowers = false;
        character.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (['dominion', 'essence', 'song'].includes(power.id)) {
                summary += `<p><strong>${powerName}</strong> (GM approval required)</p>`;
                hasAncientPowers = true;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    // Calculate actual cost with credits
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName, creditValue] = credit.split(':');
                        const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                summary += `<p><strong>${powerName}</strong> (${displayCost} pts)</p>`;
            }
        });
        
        if (hasAncientPowers) {
            summary += '<p style="color: #EFBF04; font-style: italic;">Note: Ancient powers require GM approval and custom point costs.</p>';
        }
    }
    
    // Extras summary
    if (character.extras.length > 0) {
        summary += '<h4>Extras</h4>';
        character.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            
            summary += `<p><strong>${extraName}${extraType}</strong>${costText}</p>`;
            
            if (extra.isSimple && extra.simpleAspects && extra.simpleAspects.length > 0) {
                const validAspects = extra.simpleAspects.filter(a => a.trim() !== '');
                if (validAspects.length > 0) {
                    summary += `<p style="margin-left: 20px; font-style: italic;">Aspects: ${validAspects.join(', ')}</p>`;
                }
            } else if (!extra.isSimple && extra.features.length > 0) {
                const featureGroups = {};
                extra.features.forEach(f => {
                    if (!featureGroups[f.name]) featureGroups[f.name] = [];
                    featureGroups[f.name].push(f);
                });
                const featureList = Object.entries(featureGroups).map(([name, instances]) => {
                    if (instances.length === 1) {
                        const instance = instances[0];
                        if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                            return `${name} (${instance.skillUsed}→${instance.skillReplaced})`;
                        } else if (name === 'Focus' && instance.skill) {
                            return `${name} (+2 ${instance.skill})`;
                        }
                        return name;
                    } else {
                        return `${name} (×${instances.length})`;
                    }
                }).join(', ');
                summary += `<p style="margin-left: 20px; font-style: italic;">Features: ${featureList}</p>`;
            }
        });
    }
    
    summary += `<h4>Point Allocation</h4>`;
    summary += `<p><strong>Total Available:</strong> ${character.totalPoints}</p>`;
    summary += `<p><strong>Used:</strong> ${character.usedPoints}</p>`;
    summary += `<p><strong>Good Stuff Rating:</strong> ${character.totalPoints - character.usedPoints}</p>`;
    
    summaryDiv.innerHTML = summary;
}

// Save/Load functionality
function saveCharacter() {
    try {
        // Ensure character.extras exists
        if (!character.extras) character.extras = [];
        
        // Save form values
        const saveData = {
            ...character,
            concept: document.getElementById('concept').value,
            position: document.getElementById('position').value,
            trouble: document.getElementById('trouble').value,
            goal: document.getElementById('goal').value,
            secret: document.getElementById('secret').value,
            formValues: {
                heritage: document.getElementById('heritage').value,
                skills: {},
                powers: {}
            },
            extraIdCounter: extraIdCounter,
            featureInstanceCounter: featureInstanceCounter
        };

        // Save skill values
        const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
        skills.forEach(skill => {
            saveData.formValues.skills[skill] = document.getElementById(skill).value;
        });

        // Save power selections
        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        powerElements.forEach(element => {
            saveData.formValues.powers[element.id] = element.checked;
        });

        console.log('Saving character with', saveData.extras.length, 'extras');
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
        
        // Restore character object properties
        if (saveData.heritage) character.heritage = saveData.heritage;
        if (saveData.totalPoints) character.totalPoints = saveData.totalPoints;
        if (saveData.usedPoints !== undefined) character.usedPoints = saveData.usedPoints;
        if (saveData.skills) character.skills = saveData.skills;
        if (saveData.powers) character.powers = saveData.powers;
        
        // Initialize extras array if it doesn't exist
        if (!character.extras) character.extras = [];
        
        // Restore form values
        if (saveData.concept) document.getElementById('concept').value = saveData.concept;
        if (saveData.position) document.getElementById('position').value = saveData.position;
        if (saveData.trouble) document.getElementById('trouble').value = saveData.trouble;
        if (saveData.goal) document.getElementById('goal').value = saveData.goal;
        if (saveData.secret) document.getElementById('secret').value = saveData.secret;

        // Restore heritage
        if (saveData.formValues && saveData.formValues.heritage) {
            document.getElementById('heritage').value = saveData.formValues.heritage;
            updateHeritage();
        } else if (saveData.heritage) {
            document.getElementById('heritage').value = saveData.heritage;
            updateHeritage();
        }

        // Restore skills
        if (saveData.formValues && saveData.formValues.skills) {
            Object.entries(saveData.formValues.skills).forEach(([skill, value]) => {
                if (document.getElementById(skill)) {
                    document.getElementById(skill).value = value;
                }
            });
            updateSkills();
        }

        // Restore powers
        if (saveData.formValues && saveData.formValues.powers) {
            Object.entries(saveData.formValues.powers).forEach(([powerId, checked]) => {
                const element = document.getElementById(powerId);
                if (element) {
                    element.checked = checked;
                }
            });
            updatePowers();
        }

        // Restore extras with improved error handling
        if (saveData.extras && Array.isArray(saveData.extras)) {
            character.extras = saveData.extras;
            extraIdCounter = saveData.extraIdCounter || 0;
            featureInstanceCounter = saveData.featureInstanceCounter || 0;
            
            // Migrate old simpleAspect to simpleAspects array
            character.extras.forEach(extra => {
                if (extra.simpleAspect && !extra.simpleAspects) {
                    extra.simpleAspects = extra.simpleAspect ? [extra.simpleAspect] : [];
                    delete extra.simpleAspect;
                }
                if (!extra.simpleAspects) extra.simpleAspects = [];
                
                // Ensure features array exists
                if (!extra.features) extra.features = [];
                
                // Ensure required properties exist
                if (extra.isEditing === undefined) extra.isEditing = false;
            });
            
            // Clear existing extras display
            const extrasContainer = document.getElementById('extrasContainer');
            if (extrasContainer) {
                extrasContainer.innerHTML = '';
                
                // Re-render all extras
                character.extras.forEach(extra => {
                    renderExtra(extra);
                });
            }
        } else {
            // No extras found, initialize empty array
            character.extras = [];
        }

        console.log('Character loaded successfully. Extras count:', character.extras.length);
        
        document.getElementById('saveStatus').textContent = 'Loaded previous save ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 3000);
    } catch (error) {
        console.error('Load failed:', error);
        // Initialize empty extras array on error
        if (!character.extras) character.extras = [];
    }
}

function resetCharacter() {
    if (confirm('Are you sure you want to reset all character data? This cannot be undone.')) {
        localStorage.removeItem('amberCharacter');
        location.reload();
    }
}

function exportCharacter() {
    // Collect all form data
    const exportData = {
        ...character,
        concept: document.getElementById('concept').value,
        position: document.getElementById('position').value,
        trouble: document.getElementById('trouble').value,
        goal: document.getElementById('goal').value,
        secret: document.getElementById('secret').value
    };
    
    // Create a formatted text version
    let output = '=== ANCIENT SECRETS CHARACTER SHEET ===\n\n';
    output += `Heritage: ${exportData.heritage}\n`;
    output += `Concept: ${exportData.concept}\n`;
    output += `Position: ${exportData.position}\n`;
    output += `Trouble: ${exportData.trouble}\n`;
    output += `Goal: ${exportData.goal}\n`;
    output += `Secret: ${exportData.secret}\n\n`;
    
    output += '=== SKILLS ===\n';
    Object.entries(exportData.skills).forEach(([skill, value]) => {
        output += `${skill.charAt(0).toUpperCase() + skill.slice(1)}: ${value >= 0 ? '+' : ''}${value}\n`;
    });
    
    if (exportData.powers.length > 0) {
        output += '\n=== POWERS ===\n';
        exportData.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (['dominion', 'essence', 'song'].includes(power.id)) {
                output += `${powerName} (GM approval required)\n`;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName, creditValue] = credit.split(':');
                        const hasPowerForCredit = exportData.powers.some(p => p.id === powerName);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                output += `${powerName} (${displayCost} pts)\n`;
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
            
            if (extra.isSimple && extra.simpleAspects && extra.simpleAspects.length > 0) {
                const validAspects = extra.simpleAspects.filter(a => a.trim() !== '');
                if (validAspects.length > 0) {
                    output += `  Aspects: ${validAspects.join(', ')}\n`;
                }
            } else if (!extra.isSimple && extra.features.length > 0) {
                const featureGroups = {};
                extra.features.forEach(f => {
                    if (!featureGroups[f.name]) featureGroups[f.name] = [];
                    featureGroups[f.name].push(f);
                });
                
                Object.entries(featureGroups).forEach(([name, instances]) => {
                    if (instances.length === 1) {
                        const instance = instances[0];
                        output += `  ${name}`;
                        if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                            output += `: Use ${instance.skillUsed} in place of ${instance.skillReplaced}`;
                            if (instance.circumstance) {
                                output += ` when ${instance.circumstance}`;
                            }
                        } else if (name === 'Focus' && instance.skill) {
                            output += `: +2 to ${instance.skill}`;
                            if (instance.circumstance) {
                                output += ` when ${instance.circumstance}`;
                            }
                        } else if (instance.description) {
                            output += `: ${instance.description}`;
                        } else if (instance.ability) {
                            output += `: ${instance.ability}`;
                        }
                        output += '\n';
                    } else {
                        output += `  ${name} (×${instances.length})\n`;
                        instances.forEach((instance, i) => {
                            output += `    #${i + 1}`;
                            if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                                output += `: Use ${instance.skillUsed} in place of ${instance.skillReplaced}`;
                                if (instance.circumstance) {
                                    output += ` when ${instance.circumstance}`;
                                }
                            } else if (name === 'Focus' && instance.skill) {
                                output += `: +2 to ${instance.skill}`;
                                if (instance.circumstance) {
                                    output += ` when ${instance.circumstance}`;
                                }
                            } else if (instance.description) {
                                output += `: ${instance.description}`;
                            } else if (instance.ability) {
                                output += `: ${instance.ability}`;
                            }
                            if (instance.skillMods && instance.skillMods.length > 0) {
                                const skillList = instance.skillMods.map(sm => `${sm.skill}(${sm.value >= 0 ? '+' : ''}${sm.value})`).join(', ');
                                output += ` - Skills: ${skillList}`;
                            }
                            output += '\n';
                        });
                    }
                });
            }
        });
    }
    
    output += `\n=== POINT SUMMARY ===\n`;
    output += `Total Available: ${exportData.totalPoints}\n`;
    output += `Used: ${exportData.usedPoints}\n`;
    output += `Good Stuff Rating: ${exportData.totalPoints - exportData.usedPoints}\n`;
    
    // Create downloadable file
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ancient-secrets-character.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize and set up auto-save
document.addEventListener('DOMContentLoaded', function() {
    loadCharacter();
    updatePointsDisplay();
    
    // Add event listeners for text inputs
    const textInputs = ['concept', 'position', 'trouble', 'goal', 'secret'];
    textInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', saveCharacter);
            element.addEventListener('blur', saveCharacter);
        }
    });
});