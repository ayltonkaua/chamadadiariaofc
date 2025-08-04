import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
  } from "@/components/ui/pagination"; // Importa os blocos do seu arquivo existente
  
  interface ControlledPaginationProps {
    totalItems: number;
    itemsPerPage: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  }
  
  export function ControlledPagination({
    totalItems,
    itemsPerPage,
    currentPage,
    onPageChange,
  }: ControlledPaginationProps) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
  
    // Não renderiza nada se houver apenas uma página ou nenhuma
    if (totalPages <= 1) {
      return null;
    }
  
    const handlePrevious = () => {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    };
  
    const handleNext = () => {
      if (currentPage < totalPages) {
        onPageChange(currentPage + 1);
      }
    };
  
    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handlePrevious();
              }}
              // Desabilita o link se estiver na primeira página
              className={currentPage === 1 ? "pointer-events-none text-muted-foreground" : ""}
            />
          </PaginationItem>
  
          {/* Você pode adicionar os números das páginas aqui se quiser no futuro */}
          <PaginationItem>
            <span className="p-2 text-sm">
              Página {currentPage} de {totalPages}
            </span>
          </PaginationItem>
          
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleNext();
              }}
               // Desabilita o link se estiver na última página
              className={currentPage === totalPages ? "pointer-events-none text-muted-foreground" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  }