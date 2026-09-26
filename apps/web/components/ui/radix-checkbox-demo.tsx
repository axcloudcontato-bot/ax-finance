import { Checkbox } from "@/components/ui/radix-checkbox";

export const RadixCheckboxDemo = () => {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox defaultChecked id="terms" />
      <label htmlFor="terms" className="text-sm leading-none font-medium select-none">Accept terms and conditions</label>
    </div>
  );
};
