
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewTurmaButtonProps {
  onClick?: () => void;
}

export const NewTurmaButton: React.FC<NewTurmaButtonProps> = ({ onClick }) => {
  return (
    <div className="fixed bottom-8 right-8">
      <Button
        className="h-14 w-14 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700"
        onClick={onClick}
      >
        <Plus size={24} />
      </Button>
    </div>
  );
};
