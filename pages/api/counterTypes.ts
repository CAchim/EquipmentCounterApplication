export interface Project
{
    entry_id: number,
    project_name: string,
    adapter_code: string,
    fixture_type: string,
    owner_email: string,
    contacts: number,
    contacts_limit: number,
    warning_at: number,
    resets: number,
    testprobes: string,
    modified_by: string,
    last_update: Date,
    tp_description: tp_description
}

export interface tp_description
{
    entry_id: number,
    project_id: number,
    supplier: string,
    quantity: number,
    part_number:string,
}