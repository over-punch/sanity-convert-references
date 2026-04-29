// Shared danger mode warning modal component
import { Stack, Card, Heading, Text, Button, Checkbox, Box } from '@sanity/ui'
import { WarningOutlineIcon } from '@sanity/icons'
import { useState } from 'react'

/**
 * Danger Mode Warning Modal
 * Shows a warning when entering danger mode with option to suppress for 48 hours
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onConfirm - Callback when user confirms
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {string} props.utilityName - Name of the utility entering danger mode
 */
const DangerModeWarning = ({ isOpen, onConfirm, onCancel, utilityName }) => {
	const [suppressWarning, setSuppressWarning] = useState(false);

	const handleConfirm = () => {
		if (suppressWarning) {
			const expiryTime = Date.now() + (48 * 60 * 60 * 1000);
			localStorage.setItem('dangerModeWarningSuppress', expiryTime.toString());
		}
		onConfirm();
	};

	if (!isOpen) return null;

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 999999,
				backgroundColor: "rgba(0, 0, 0, 0.5)",
				pointerEvents: "auto"
			}}
			onClick={onCancel}
		>
			<Card
				padding={4}
				radius={2}
				shadow={3}
				style={{
					maxWidth: "500px",
					width: "90%",
					backgroundColor: "var(--card-bg-color)",
					position: "relative",
					zIndex: 1000000
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<Stack space={4}>
					<Heading as="h3" size={2}>Danger Mode Warning</Heading>

					<Stack space={3}>
						<div style={{textAlign: "center", fontSize: "3em", color: "var(--card-badge-critical-dot-color)"}}>
							<WarningOutlineIcon />
						</div>
						<Text align="center" size={2} weight="bold">
							You are about to enable Danger Mode
						</Text>
						<Text align="center" size={1} muted>
							{utilityName} can permanently modify or delete data across multiple documents. This action cannot be undone.
						</Text>
					</Stack>

					<Stack space={2}>
						<Text size={1} weight="semibold">Please ensure:</Text>
						<Text size={1} muted>• You have a backup of your data</Text>
						<Text size={1} muted>• You understand what changes will be made</Text>
						<Text size={1} muted>• You have reviewed the affected documents</Text>
					</Stack>

					<Box paddingTop={3}>
						<Checkbox
							id="suppress-warning"
							checked={suppressWarning}
							onChange={(event) => setSuppressWarning(event.target.checked)}
						/>
						<Box flex={1} paddingLeft={3} style={{display: "inline-block", transform: "translate(0, -10px)"}}>
							<Text size={1}>
								<label htmlFor="suppress-warning">Don't show this warning for 48 hours</label>
							</Text>
						</Box>
					</Box>

					<Stack space={2}>
						<Button
							text="Enable Danger Mode"
							tone="critical"
							onClick={handleConfirm}
							style={{cursor: "pointer"}}
						/>
						<Button
							text="Cancel"
							mode="ghost"
							onClick={onCancel}
							style={{cursor: "pointer"}}
						/>
					</Stack>
				</Stack>
			</Card>
		</div>
	);
};

/**
 * Check if danger mode warning should be shown
 * @returns {boolean} - True if warning should be shown
 */
export const shouldShowDangerWarning = () => {
	const suppressUntil = localStorage.getItem('dangerModeWarningSuppress');
	if (!suppressUntil) return true;

	const expiryTime = parseInt(suppressUntil, 10);
	if (Date.now() > expiryTime) {
		localStorage.removeItem('dangerModeWarningSuppress');
		return true;
	}

	return false;
};

export default DangerModeWarning;
