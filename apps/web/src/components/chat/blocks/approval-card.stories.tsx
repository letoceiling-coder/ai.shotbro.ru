import type { Meta, StoryObj } from "@storybook/react";
import { ApprovalCard } from "./approval-card";

const meta: Meta<typeof ApprovalCard> = {
  title: "SHOTBRO/ApprovalCard",
  component: ApprovalCard,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof ApprovalCard>;

export const Pending: Story = {
  args: {
    projectId: "demo",
    block: {
      type: "approval",
      demo: true,
      approvalId: "demo-approval",
      title: "Согласование сценария",
      description: "Утвердите сценарий для демо.",
      status: "pending",
      tags: ["9:16", "15 секунд"],
      actions: [
        { id: "approve", label: "Утвердить", variant: "primary" },
        { id: "edit", label: "Изменить", variant: "secondary" },
      ],
    },
  },
};

export const Approved: Story = {
  args: {
    projectId: "demo",
    block: {
      type: "approval",
      demo: true,
      approvalId: "demo-approval",
      title: "Согласование сценария",
      status: "approved",
      actions: [
        { id: "approve", label: "Утвердить", variant: "primary" },
        { id: "edit", label: "Изменить", variant: "secondary" },
      ],
    },
  },
};
