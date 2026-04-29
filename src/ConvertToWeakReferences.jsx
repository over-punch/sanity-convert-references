// Component for converting strong references to weak references and checking reference integrity
import { Stack, Grid, Heading, Text, Button, TextInput, Select, Card, Flex, Badge, Box } from '@sanity/ui'
import { CollapseIcon, ExpandIcon, LockIcon, UnlockIcon } from '@sanity/icons'
import { useState, useEffect } from 'react'
import DangerModeWarning, { shouldShowDangerWarning } from './DangerModeWarning'

/**
 * Convert to Weak References Component
 * Converts strong references to weak references across documents
 * @param {Object} props - Component props
 * @param {SanityClient} props.client - Sanity client instance
 */
const ConvertToWeakReferences = ({ icon: Icon, displayName, dangerMode, utilityId, onDangerModeChange, ...props }) => {
	const { client } = props;
	const [ convertValue, setConvertValue ] = useState('');
	const [ convertible, setConvertible ] = useState([]);
	const [ convertibleMessage, setConvertibleMessage ] = useState('');
	const [ convertType, setConvertType ] = useState('typeface');
	const [ excludeValue, setExcludeValue ] = useState('');
	const [ exclude, setExclude ] = useState(false);
	const [showWarningModal, setShowWarningModal] = useState(false);
	const [operationMode, setOperationMode] = useState('convert'); // 'convert' or 'scan'
	const [brokenReferences, setBrokenReferences] = useState([]);
	const [scanningMessage, setScanningMessage] = useState('');

	/**
	 * Handle danger mode toggle with warning modal
	 */
	const handleDangerModeToggle = () => {
		if (!dangerMode && shouldShowDangerWarning()) {
			// Trying to enable danger mode, show warning
			setShowWarningModal(true);
		} else {
			// Either disabling danger mode or warning is suppressed
			onDangerModeChange(utilityId, !dangerMode);
		}
	};

	const handleWarningConfirm = () => {
		setShowWarningModal(false);
		onDangerModeChange(utilityId, true);
	};

	const handleWarningCancel = () => {
		setShowWarningModal(false);
	};

	useEffect(() => {
		if (!exclude) setExcludeValue("");
	}, [exclude]);

	async function scanForBrokenReferences() {
		setScanningMessage('Scanning for broken references...');
		try {
			// Get all documents with references
			const docsWithRefs = await client.fetch(`
				*[_type == "${convertType}" && title match "${convertValue}*" ${excludeValue !== "" ? ` && !(title match "*${excludeValue}*")` : ""}]
			`);

			const broken = [];

			for (const doc of docsWithRefs) {
				const refs = findReferencesInDocument(doc);

				for (const ref of refs) {
					// Check if the referenced document exists
					const refDoc = await client.fetch(`*[_id == $refId][0]`, { refId: ref.refId });

					if (!refDoc) {
						broken.push({
							docId: doc._id,
							docTitle: doc.title || doc._id,
							fieldPath: ref.path,
							brokenRefId: ref.refId,
							isWeak: ref.isWeak
						});
					}
				}
			}

			setBrokenReferences(broken);
			if (broken.length === 0) {
				setScanningMessage('No broken references found!');
			} else {
				setScanningMessage(`Found ${broken.length} broken reference${broken.length !== 1 ? 's' : ''}`);
			}
		} catch (err) {
			console.error('Scan error:', err);
			setScanningMessage('Error: ' + err.message);
		}
	}

	// Recursively find all references in a document
	function findReferencesInDocument(obj, path = '', refs = []) {
		if (!obj || typeof obj !== 'object') return refs;

		if (obj._ref) {
			refs.push({
				refId: obj._ref,
				path: path,
				isWeak: obj._weak || false
			});
		}

		for (const key in obj) {
			if (obj.hasOwnProperty(key) && key !== '_ref' && key !== '_weak' && key !== '_type') {
				const newPath = path ? `${path}.${key}` : key;
				if (Array.isArray(obj[key])) {
					obj[key].forEach((item, index) => {
						findReferencesInDocument(item, `${newPath}[${index}]`, refs);
					});
				} else if (typeof obj[key] === 'object') {
					findReferencesInDocument(obj[key], newPath, refs);
				}
			}
		}

		return refs;
	}

	async function searchFor(value) {
		const items = await client.fetch(`
			*[
				_type == "${convertType}"
				&& title match "${value}*"
				${excludeValue !== "" ? ` && !(title match "*${excludeValue}*")` : ""}
			]
		`)
		setConvertible(items)
	}

	useEffect(() => {
		searchFor(convertValue)
	}, [convertValue, convertType, excludeValue])

	function convert(){
		setConvertibleMessage('Updating data...');
		client
			.fetch(`
				*[
					_type == "${convertType}"
					&& title match "${convertValue}*"
					${excludeValue !== "" ? ` && !(title match "*${excludeValue}*")` : ""}
				]
			`)
			.then( async (items) => {
				let updateDataCount = 0;

				// convert items to string
				let itemsString = JSON.stringify(items);

				// search for all `"_type":"reference"` and replace with `"_type":"reference","_weak":true`
				itemsString = itemsString.replace(/"_type":"reference"/g, '"_type":"reference","_weak":true');

				// convert string back to object
				let itemsObject = JSON.parse(itemsString);

				for (const item of itemsObject) {
					try {
						setConvertibleMessage(`Updating: ${item?.title ? item.title : item._id}`);
						client.patch(item._id).set(item).commit()
					} catch (e) {
						console.error(e.message)
						setConvertibleMessage('Error: ' + e.message);
					}
					await new Promise(r => setTimeout(r, 50));

					updateDataCount++;
					if (updateDataCount == itemsObject.length - 1) {
						setConvertibleMessage('All Updated!');
						setTimeout(()=>{
							setConvertibleMessage("");
						}, 2000)
					}
				}
			})
			.catch( (err)=>{ console.error(err) })
	}

	return (
		<>
			<DangerModeWarning
				isOpen={showWarningModal}
				onConfirm={handleWarningConfirm}
				onCancel={handleWarningCancel}
				utilityName="Convert to Weak References"
			/>

			<Stack style={{paddingTop: "4em", paddingBottom: "2em", position: "relative"}}>
				<Heading as="h3" size={3}>{Icon && <Icon style={{display: 'inline-block', marginRight: '0.35em', opacity: 0.5, transform: 'translateY(2px)'}} />}{displayName}</Heading>
				<Text muted size={1} style={{paddingTop: "2em", maxWidth: "calc(100% - 100px)"}}>
					{operationMode === 'convert'
						? 'Transform strong document references into weak references across matching documents. Weak references don\'t prevent deletion and are useful for non-critical relationships.'
						: 'Scan documents for broken references pointing to deleted or missing documents. Identify orphaned references that need cleanup or fixing.'
					}
				</Text>
				<div style={{position: "absolute", bottom: "1.5em", right: "0"}}>
					<Button
						mode={exclude?"ghost":"bleed"}
						tone="positive"
						icon={exclude?CollapseIcon:ExpandIcon}
						onClick={() => { setExclude(!exclude) }}
						style={{cursor: "pointer", marginLeft: ".5em"}}
					/>
					<Button
						mode={dangerMode?"ghost":"bleed"}
						tone="critical"
						icon={dangerMode?UnlockIcon:LockIcon}
						onClick={handleDangerModeToggle}
						style={{cursor: "pointer", marginLeft: ".5em"}}
					/>
				</div>
			</Stack>

			{/* Operation Mode Selection */}
			<Stack style={{marginTop: "1em"}}>
				<Grid columns={[2]} gap={2}>
					<Button
						text="Convert to Weak"
						mode={operationMode === 'convert' ? 'default' : 'ghost'}
						onClick={() => setOperationMode('convert')}
						style={{cursor: "pointer"}}
					/>
					<Button
						text="Scan for Broken Refs"
						mode={operationMode === 'scan' ? 'default' : 'ghost'}
						onClick={() => setOperationMode('scan')}
						style={{cursor: "pointer"}}
					/>
				</Grid>
			</Stack>

			<Stack style={{ position: "relative" }} >
				<Grid columns={exclude ? [3] : [2]} gap={0}
					style={{
						position: "relative",
					}}
				>
					<TextInput
						style={{
							borderRadius: "3px 0 0 0",
						}}
						onChange={(event) => { setConvertValue(event.currentTarget.value) }}
						placeholder="Name"
						value={convertValue}
					/>
					{!!exclude &&
						<TextInput
							style={{
								display: exclude ? "" : "none",
							}}
							onChange={(event) => { setExcludeValue(event.currentTarget.value) }}
							placeholder="Excluding"
							value={excludeValue}
						/>
					}
					<Select
						style={{
							borderRadius: "0 3px 0 0",
						}}
						onChange={(event) => { setConvertType(event.currentTarget.value) }}
						value={convertType}
					>
						<option value="typeface">Typeface</option>
						<option value="collection">Collection</option>
						<option value="pair">Pair</option>
						<option value="font">Font</option>
						<option value="license">License</option>
						<option value="order">Order</option>
						<option value="account">Account</option>
						<option value="cart">Cart</option>
						<option value="page">Page</option>
						<option value="blogpost">Blogpost</option>
					</Select>
				</Grid>
			</Stack>

			{/* Scan Mode - Show broken references */}
			{operationMode === 'scan' && (
				<>
					<Stack style={{marginTop: "1em"}}>
						<Button
							text="Scan for Broken References"
							tone="primary"
							onClick={scanForBrokenReferences}
							style={{cursor: "pointer"}}
						/>
					</Stack>

					{scanningMessage && (
						<Stack style={{marginTop: "1em"}}>
							<Text size={1} muted>{scanningMessage}</Text>
						</Stack>
					)}

					{brokenReferences.length > 0 && (
						<>
							<Card padding={3} tone="critical" border={1} style={{marginTop: "1em"}}>
								<Text size={1}>
									Found <strong>{brokenReferences.length}</strong> broken reference{brokenReferences.length !== 1 ? 's' : ''} in {convertible.length} document{convertible.length !== 1 ? 's' : ''}
								</Text>
							</Card>

							<div
								style={{
									maxHeight: "400px",
									marginTop: "5px",
									border: "1px solid rgba(255,255,255,0.1)",
									overflow: "auto",
									paddingBottom: "1rem",
									borderRadius: "3px",
								}}
							>
								{brokenReferences.map((ref, index) => (
									<Card
										key={`broken-${index}`}
										padding={3}
										style={{
											margin: "0.5em",
											borderLeft: "3px solid var(--card-badge-critical-dot-color)"
										}}
									>
										<Stack space={2}>
											<Flex gap={2} align="center">
												<Text size={1} weight="bold">{ref.docTitle}</Text>
												<Badge tone={ref.isWeak ? 'caution' : 'critical'}>
													{ref.isWeak ? 'Weak' : 'Strong'}
												</Badge>
											</Flex>
											<Text size={0} muted>Field: {ref.fieldPath}</Text>
											<Text size={0} muted style={{fontFamily: 'monospace'}}>
												Missing ID: {ref.brokenRefId}
											</Text>
											<a
												target="_blank"
												className="link"
												href={`${window.location.origin}/desk/${(convertType === "typeface" || convertType === "licenseGroup") ? "orderable-" : ""}${convertType};${ref.docId}`}
											>
												<Text size={0}>View document →</Text>
											</a>
										</Stack>
									</Card>
								))}
							</div>
						</>
					)}
				</>
			)}

			{/* Convert Mode - Original functionality */}
			{operationMode === 'convert' && (
				<>
					{ convertibleMessage!="" && (
						<Stack>
							<p style={{padding: ".5em 0em 1em", opacity: "0.75"}} dangerouslySetInnerHTML={{__html:  convertibleMessage}}></p>
						</Stack>
					)}

					{ convertible.length > 0 && (
				<>
					<div
						style={{
							maxHeight: "400px",
							marginTop: "5px",
							border: "1px solid rgba(255,255,255,0.1)",
							overflow: "auto",
							paddingBottom: "1rem",
							borderRadius: "3px",
						}}
					>
						{ convertible.map((item, index) => (
							<a
								target="_blank"
								key={`item-${index}`}
								className="link"
								href={`${window.location.origin}/desk/${(convertType === "typeface" || convertType === "licenseGroup") ? "orderable-" : ""}${convertType};${item._id}`}
							>
								<Stack>
									<Text size={1} style={{padding: "1em 1em .5em"}}>{item.title}</Text>
								</Stack>
							</a>
						))}
					</div>
					<div style={{pointerEvents: "none", textAlign: "right", top: "-30px", paddingRight: "10px", position: "relative", height: "30px"}}>{ convertible.length} items</div>

					{dangerMode && (
						<Stack>
							<Button text="Convert" tone="critical" onClick={() => { convert() }}/>
						</Stack>
					)}
					</>
				)}
				</>
			)}
		</>
	)
}

export default ConvertToWeakReferences
